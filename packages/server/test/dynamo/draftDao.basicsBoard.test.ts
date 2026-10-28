jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(() => ({ type: 'Creature', color_identity: ['U'], oracle_id: 'oracle-1' })),
}));

jest.mock('serverutils/archetype', () => ({
  classifyDeck: jest.fn(async () => 'Tempo'),
}));

jest.mock('../../src/dynamo/s3client', () => ({
  getObject: jest.fn(),
  getObjectWithETag: jest.fn(),
  putObject: jest.fn(),
  putObjectIfMatch: jest.fn(),
}));

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';
import { DraftDynamoDao } from '../../src/dynamo/dao/DraftDynamoDao';
import { UserDynamoDao } from '../../src/dynamo/dao/UserDynamoDao';
import { getObject } from '../../src/dynamo/s3client';

const TABLE = 'TEST_TABLE';

describe('DraftDynamoDao basicsBoard', () => {
  let send: jest.Mock;
  let dao: DraftDynamoDao;
  let stored: Record<string, any> | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATA_BUCKET = 'test-bucket';
    stored = undefined;

    send = jest.fn(async (command: any) => {
      if (command instanceof PutCommand) {
        stored = command.input.Item;
        return {};
      }
      if (command instanceof GetCommand) {
        return { Item: stored };
      }
      return {};
    });
    const cubeDao = { getById: jest.fn(async () => ({ name: 'Test Cube' })) } as unknown as CubeDynamoDao;
    const userDao = {
      getById: jest.fn(async (id: string) => ({ id, username: id })),
      batchGet: jest.fn(async () => []),
    } as unknown as UserDynamoDao;
    dao = new DraftDynamoDao({ send } as any, cubeDao, userDao, TABLE);

    (getObject as jest.Mock).mockImplementation(async (_bucket: string, key: string) =>
      key.startsWith('cardlist/') ? [{ cardID: 'c0' }] : { seats: [{ mainboard: [[[0]]], sideboard: [[[]]] }] },
    );
  });

  const create = (basicsBoard?: string) =>
    dao.createDraft({
      seats: [{ mainboard: [[[0]]], sideboard: [[[]]] }],
      cards: [{ cardID: 'c0' }],
      cube: 'cube-1',
      cubeOwner: 'owner-1',
      owner: 'owner-1',
      type: 'd',
      complete: true,
      basicsBoard,
    });

  it('persists the basics board a draft was created with', async () => {
    const id = await create('None');

    expect(stored!.item.basicsBoard).toBe('None');
    expect((await dao.getById(id))!.basicsBoard).toBe('None');
  });

  it('leaves basicsBoard unset when the draft has none', async () => {
    const id = await create();

    expect((await dao.getById(id))!.basicsBoard).toBeUndefined();
  });
});
