jest.mock('serverutils/imageutil', () => ({
  getImageData: jest.fn(() => ({ uri: 'image.png' })),
}));

import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { UserRoles } from '@utils/datatypes/User';

import { PasswordResetDynamoDao } from '../../src/dynamo/dao/PasswordResetDynamoDao';
import { PatronDynamoDao } from '../../src/dynamo/dao/PatronDynamoDao';
import { UserDynamoDao } from '../../src/dynamo/dao/UserDynamoDao';

const TABLE = 'TEST_TABLE';

const storedUser = (overrides: Record<string, any> = {}) => ({
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  passwordHash: '$2a$10$hash',
  token: 'verification-token',
  emailVerified: false,
  pendingEmail: 'new@example.com',
  pendingEmailToken: 'change-token',
  pendingEmailExpires: 123,
  sessionVersion: 2,
  roles: [],
  ...overrides,
});

const getResponse = (item: Record<string, any>, version = 1) => ({
  Item: { PK: 'USER#user-1', SK: 'USER', DynamoVersion: version, item },
});

const SENSITIVE_FIELDS = [
  'passwordHash',
  'email',
  'token',
  'emailVerified',
  'pendingEmail',
  'pendingEmailToken',
  'pendingEmailExpires',
  'sessionVersion',
];

describe('UserDynamoDao sensitive data', () => {
  let send: jest.Mock;
  let dao: UserDynamoDao;

  beforeEach(() => {
    send = jest.fn();
    dao = new UserDynamoDao({ send } as unknown as DynamoDBDocumentClient, TABLE);
  });

  const putItem = (): any => {
    const put = send.mock.calls.map(([command]) => command).find((command) => command instanceof PutCommand);
    expect(put).toBeDefined();
    return put;
  };

  it('keeps tokens, verification state and session version off hydrated users', async () => {
    send.mockResolvedValue(getResponse(storedUser()));

    const user = await dao.getById('user-1');

    expect(user).toEqual(expect.objectContaining({ id: 'user-1', username: 'alice' }));
    for (const field of SENSITIVE_FIELDS) {
      expect(user).not.toHaveProperty(field);
    }
  });

  it('still returns them from the sensitive getter', async () => {
    send.mockResolvedValue(getResponse(storedUser()));

    const user = await dao.getByIdWithSensitiveData('user-1');

    expect(user).toEqual(
      expect.objectContaining({ token: 'verification-token', emailVerified: false, sessionVersion: 2 }),
    );
  });

  it('returns the stripped user and the session version for passport', async () => {
    send.mockResolvedValue(getResponse(storedUser()));

    const result = await dao.getByIdForSession('user-1');

    expect(result?.sessionVersion).toBe(2);
    expect(result?.user).not.toHaveProperty('sessionVersion');
    expect(result?.user).not.toHaveProperty('token');

    send.mockResolvedValue(getResponse(storedUser({ sessionVersion: undefined })));
    expect((await dao.getByIdForSession('user-1'))?.sessionVersion).toBe(0);

    send.mockResolvedValue({});
    expect(await dao.getByIdForSession('user-1')).toBeUndefined();
  });

  it('removes cleared fields from the stored row', async () => {
    const stored = storedUser();
    send.mockImplementation(async (command: any) => (command instanceof GetCommand ? getResponse(stored) : {}));

    await dao.update({ ...stored, token: '', pendingEmail: '', pendingEmailToken: '', pendingEmailExpires: 0 } as any);

    // Undefined attributes are dropped by the document client (removeUndefinedValues).
    const written = putItem().input.Item.item;
    expect(written.token).toBeUndefined();
    expect(written.pendingEmail).toBeUndefined();
    expect(written.pendingEmailToken).toBeUndefined();
    expect(written.pendingEmailExpires).toBeUndefined();
    expect(written.email).toBe('alice@example.com');
    expect(written.passwordHash).toBe('$2a$10$hash');
  });

  it('keeps sensitive fields when a hydrated (stripped) user is saved', async () => {
    const stored = storedUser();
    send.mockImplementation(async (command: any) => (command instanceof GetCommand ? getResponse(stored) : {}));

    await dao.update({ id: 'user-1', username: 'alice', about: 'hello' } as any);

    expect(putItem().input.Item.item).toEqual(
      expect.objectContaining({
        about: 'hello',
        token: 'verification-token',
        sessionVersion: 2,
        pendingEmail: 'new@example.com',
      }),
    );
  });

  it('never rolls the session version back', async () => {
    const stored = storedUser({ sessionVersion: 5 });
    send.mockImplementation(async (command: any) => (command instanceof GetCommand ? getResponse(stored) : {}));

    // A writer holding a copy from before a password change.
    await dao.update({ ...stored, sessionVersion: 4 } as any);

    expect(putItem().input.Item.item.sessionVersion).toBe(5);
  });
});

describe('UserDynamoDao dashboard dailies', () => {
  let send: jest.Mock;
  let dao: UserDynamoDao;

  beforeEach(() => {
    send = jest.fn();
    dao = new UserDynamoDao({ send } as unknown as DynamoDBDocumentClient, TABLE);
  });

  it('shows every daily to users who never chose', async () => {
    send.mockResolvedValue(getResponse(storedUser()));

    expect((await dao.getById('user-1'))?.hiddenDailyGames).toEqual([]);
  });

  it('keeps Daily P1P1 off for users who hid featured cubes before the setting existed', async () => {
    send.mockResolvedValue(getResponse(storedUser({ hideFeatured: true })));

    expect((await dao.getById('user-1'))?.hiddenDailyGames).toEqual(['dailyp1p1']);
  });

  it('respects a saved choice over hide featured cubes', async () => {
    send.mockResolvedValue(getResponse(storedUser({ hideFeatured: true, hiddenDailyGames: [] })));

    expect((await dao.getById('user-1'))?.hiddenDailyGames).toEqual([]);
  });
});

describe('UserDynamoDao role rows', () => {
  let send: jest.Mock;
  let dao: UserDynamoDao;

  beforeEach(() => {
    send = jest.fn().mockResolvedValue({});
    dao = new UserDynamoDao({ send } as unknown as DynamoDBDocumentClient, TABLE);
  });

  it('writes a row for each role gained and deletes one for each role lost', async () => {
    await dao.syncRoleRows('user-1', [UserRoles.PATRON, UserRoles.ADMIN], [UserRoles.ADMIN, UserRoles.CONTENT_CREATOR]);

    const commands = send.mock.calls.map(([command]) => command);
    expect(commands.filter((command) => command instanceof PutCommand).map((command) => command.input.Item)).toEqual([
      {
        PK: 'HASH#USER#user-1',
        SK: 'ROLE#ContentCreator',
        GSI1PK: 'USER#ROLE#ContentCreator',
        GSI1SK: 'user-1',
        userId: 'user-1',
        role: UserRoles.CONTENT_CREATOR,
      },
    ]);
    expect(commands.filter((command) => command instanceof DeleteCommand).map((command) => command.input.Key)).toEqual([
      { PK: 'HASH#USER#user-1', SK: 'ROLE#Patron' },
    ]);
  });

  it('updates the role rows when a user is saved with different roles', async () => {
    send.mockImplementation(async (command) =>
      command instanceof GetCommand ? getResponse(storedUser({ roles: [UserRoles.PATRON] })) : {},
    );

    await dao.update({ id: 'user-1', roles: [UserRoles.ADMIN] } as any);

    const commands = send.mock.calls.map(([command]) => command);
    expect(commands.some((command) => command instanceof PutCommand && command.input.Item?.SK === 'ROLE#Admin')).toBe(
      true,
    );
    expect(
      commands.some((command) => command instanceof DeleteCommand && command.input.Key?.SK === 'ROLE#Patron'),
    ).toBe(true);
  });

  it("lists a role's holders from its rows, following every page", async () => {
    send.mockImplementation(async (command) => {
      if (command instanceof QueryCommand) {
        return command.input.ExclusiveStartKey
          ? { Items: [{ userId: 'admin-2' }] }
          : { Items: [{ userId: 'admin-1' }], LastEvaluatedKey: { PK: 'HASH#USER#admin-1' } };
      }
      if (command instanceof BatchGetCommand) {
        const keys = command.input.RequestItems?.[TABLE]?.Keys as { PK: string }[];
        return {
          Responses: {
            [TABLE]: keys.map(({ PK }) => ({
              item: storedUser({ id: PK.replace('USER#', ''), roles: [UserRoles.ADMIN] }),
            })),
          },
        };
      }
      return {};
    });

    const admins = await dao.listByRole(UserRoles.ADMIN);

    expect(admins.map((user) => user.id)).toEqual(['admin-1', 'admin-2']);
    const query = send.mock.calls.map(([command]) => command).find((command) => command instanceof QueryCommand);
    expect(query.input).toMatchObject({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'USER#ROLE#Admin' },
    });
  });
});

describe('PatronDynamoDao Patreon user id', () => {
  let send: jest.Mock;
  let dao: PatronDynamoDao;

  beforeEach(() => {
    send = jest.fn().mockResolvedValue({});
    dao = new PatronDynamoDao({ send } as unknown as DynamoDBDocumentClient, TABLE);
  });

  const patron = (overrides: Record<string, any> = {}) => ({
    email: 'patron@example.com',
    level: 1,
    status: 'a',
    owner: 'user-1',
    dateCreated: 1,
    dateLastUpdated: 1,
    ...overrides,
  });

  it('stores and indexes the Patreon user id', async () => {
    await dao.put(patron({ patreonUserId: 'patreon-9' }));

    const item = send.mock.calls[0][0].input.Item;
    expect(item.item.patreonUserId).toBe('patreon-9');
    expect(item.GSI3PK).toBe('PATRON#PATREON_USER#patreon-9');
  });

  it('leaves records without one out of the index', async () => {
    await dao.put(patron());

    expect(send.mock.calls[0][0].input.Item.GSI3PK).toBeUndefined();
  });

  it('looks patrons up by Patreon user id', async () => {
    send.mockResolvedValue({ Items: [{ item: patron({ patreonUserId: 'patreon-9' }) }] });

    const found = await dao.getByPatreonUserId('patreon-9');

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(QueryCommand);
    expect(command.input).toEqual(
      expect.objectContaining({
        IndexName: 'GSI3',
        ExpressionAttributeValues: { ':patreonUser': 'PATRON#PATREON_USER#patreon-9' },
      }),
    );
    expect(found?.owner).toBe('user-1');
  });
});

describe('PasswordResetDynamoDao session version', () => {
  it('stores the owner session version with the reset', async () => {
    const send = jest.fn().mockResolvedValue({});
    const dao = new PasswordResetDynamoDao({ send } as unknown as DynamoDBDocumentClient, TABLE);

    await dao.putAndReturnId({ owner: 'user-1', date: 1, sessionVersion: 3 });

    expect(send.mock.calls[0][0].input.Item.item).toEqual(
      expect.objectContaining({ owner: 'user-1', sessionVersion: 3 }),
    );
  });
});
