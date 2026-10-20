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

import { BatchWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';
import { createCube, createUser } from '../test-utils/data';

const TABLE = 'TEST_TABLE';
const owner = createUser();

describe('CubeDynamoDao search hash rows', () => {
  let send: jest.Mock;
  let dao: CubeDynamoDao;

  const storedCube = createCube({
    id: 'cube-1',
    owner,
    name: 'Vintage Cube',
    likeCount: 4,
    cardCount: 360,
    dateLastUpdated: 1_000,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // The table still holds the pre-update cube for every read during update().
    const { owner: _owner, image: _image, ...row } = storedCube;
    send = jest.fn(async (command: any) =>
      command instanceof GetCommand
        ? { Item: { PK: 'CUBE#cube-1', SK: 'CUBE', DynamoVersion: 1, item: { ...row, owner: owner.id } } }
        : {},
    );
    const userDao = { getById: jest.fn(async () => owner), batchGet: jest.fn(async () => [owner]) };
    dao = new CubeDynamoDao({ send } as any, userDao as any, TABLE);
  });

  const writtenHashRows = () =>
    send.mock.calls
      .map(([command]) => command)
      .filter((command: any) => command instanceof BatchWriteCommand)
      .flatMap((command: any) => command.input.RequestItems[TABLE])
      .filter((request: any) => request.PutRequest)
      .map((request: any) => request.PutRequest.Item);

  it('rewrites existing hash rows with the updated sort values', async () => {
    await dao.update({ ...storedCube, likeCount: 9, cardCount: 450 });

    const rows = writtenHashRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.GSI1SK).toBe(`FOLLOWERS#${String(9).padStart(10, '0')}`);
      expect(row.GSI3SK).toBe(`CARDS#${String(450).padStart(10, '0')}`);
      expect(row.GSI4SK).not.toBe(`DATE#${String(1_000).padStart(15, '0')}`);
      expect(row.cubeFollowers).toBe(9);
      expect(row.cubeCardCount).toBe(450);
    }
  });

  it('writes hash rows added by a rename with the new name', async () => {
    await dao.update({ ...storedCube, name: 'Legacy Cube' });

    const rows = writtenHashRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.GSI2SK).toBe('NAME#legacy cube');
      expect(row.cubeName).toBe('Legacy Cube');
    }
  });

  it('does not re-read the cube to build hash rows', async () => {
    await dao.update({ ...storedCube, likeCount: 9 });

    const commands = send.mock.calls.map(([command]) => command);
    const firstBatchWrite = commands.findIndex((command: any) => command instanceof BatchWriteCommand);
    const readsBeforeHashWrite = commands
      .slice(0, firstBatchWrite)
      .filter((command: any) => command instanceof GetCommand);
    expect(readsBeforeHashWrite).toHaveLength(1);
  });
});
