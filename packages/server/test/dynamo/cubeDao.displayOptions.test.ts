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

import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';
import { createCube, createUser } from '../test-utils/data';

const owner = createUser();

describe('CubeDynamoDao display options', () => {
  let send: jest.Mock;
  let dao: CubeDynamoDao;

  beforeEach(() => {
    jest.clearAllMocks();
    const { owner: _owner, image: _image, ...row } = createCube();
    send = jest.fn(async (command: any) =>
      command instanceof GetCommand
        ? { Item: { PK: 'CUBE#x', SK: 'CUBE', DynamoVersion: 3, item: { ...row, owner: owner.id } } }
        : {},
    );
    const userDao = { getById: jest.fn(async () => owner), batchGet: jest.fn(async () => [owner]) };
    dao = new CubeDynamoDao({ send } as any, userDao as any, 'TEST_TABLE');
  });

  it('update persists all seven display options', async () => {
    const flipped = Object.fromEntries(
      Object.entries(DEFAULT_CUBE_DISPLAY_OPTIONS).map(([key, value]) => [key, !value]),
    );

    await dao.update(createCube(flipped));

    const put = send.mock.calls
      .map(([c]) => c)
      .find((c: any) => c instanceof PutCommand && c.input.Item?.SK === 'CUBE')!.input.Item!.item;
    for (const [key, value] of Object.entries(flipped)) {
      expect(put[key]).toBe(value);
    }
  });
});
