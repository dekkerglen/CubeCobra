jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(),
  getPlaceholderCard: jest.fn(),
}));

jest.mock('serverutils/cloudwatch', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('serverutils/imageutil', () => ({
  getImageData: jest.fn(() => ({ uri: 'img', artist: 'a', id: 'i', imageName: 'n' })),
}));

jest.mock('../../src/dynamo/s3client', () => ({
  getObject: jest.fn(),
  putObject: jest.fn(),
  deleteObject: jest.fn(),
  getObjectVersion: jest.fn(),
  listObjectVersions: jest.fn(),
}));

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';
import { createCube, createUser } from '../test-utils/data';

const owner = createUser();

describe('CubeDynamoDao heroTheme', () => {
  let send: jest.Mock;
  let dao: CubeDynamoDao;

  const buildDao = (storedOverrides: Record<string, unknown> = {}) => {
    const base = createCube({ owner, date: 1, dateLastUpdated: 1 });
    const { owner: _owner, image: _image, ...row } = base;
    send = jest.fn(async (command: any) =>
      command instanceof GetCommand
        ? {
            Item: { PK: 'CUBE#x', SK: 'CUBE', DynamoVersion: 3, item: { ...row, owner: owner.id, ...storedOverrides } },
          }
        : {},
    );
    const userDao = { getById: jest.fn(async () => owner), batchGet: jest.fn(async () => [owner]) };
    dao = new CubeDynamoDao({ send } as any, userDao as any, 'TEST_TABLE');
  };

  const storedCubeItem = () =>
    send.mock.calls.map(([c]) => c).find((c: any) => c instanceof PutCommand && c.input.Item?.SK === 'CUBE')!.input
      .Item!.item;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('round-trips a stored heroTheme', async () => {
    buildDao({ heroTheme: 'blue' });

    const cube = await dao.getById('x');

    expect(cube?.heroTheme).toBe('blue');
  });

  it('persists heroTheme on update', async () => {
    buildDao();

    await dao.update(createCube({ owner, heroTheme: 'blue' }));

    expect(storedCubeItem().heroTheme).toBe('blue');
  });

  it('omits heroTheme when the cube has none', async () => {
    buildDao();

    await dao.update(createCube({ owner }));

    expect(storedCubeItem()).not.toHaveProperty('heroTheme');
  });

  it('omits heroTheme when it is an empty string', async () => {
    buildDao();

    await dao.update(createCube({ owner, heroTheme: '' as any }));

    expect(storedCubeItem()).not.toHaveProperty('heroTheme');
  });
});
