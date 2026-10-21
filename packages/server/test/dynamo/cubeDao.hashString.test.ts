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

import { QueryCommand } from '@aws-sdk/lib-dynamodb';

import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';

const TABLE = 'TEST_TABLE';

describe('CubeDynamoDao hash string parsing', () => {
  let send: jest.Mock;
  let dao: CubeDynamoDao;

  beforeEach(() => {
    jest.clearAllMocks();
    send = jest.fn(async () => ({ Items: [] }));
    dao = new CubeDynamoDao({ send } as any, { getById: jest.fn(), batchGet: jest.fn(async () => []) } as any, TABLE);
  });

  const queriedHashKeys = () =>
    send.mock.calls
      .map(([command]) => command)
      .filter((command: any) => command instanceof QueryCommand)
      .map((command: any) => command.input.ExpressionAttributeValues[':hash']);

  const primaryKeyFor = async (run: () => Promise<unknown>) => {
    send.mockClear();
    await run();
    const keys = queriedHashKeys();
    expect(keys[0]).toEqual(expect.any(String));
    return keys[0];
  };

  // Tag values are free-form, so they can contain colons. Splitting the "type:value" hash string
  // on every colon would look up `tag:combo` and silently return the wrong cubes.
  it('keeps colons in the value of a hash string', async () => {
    const fromHashString = await primaryKeyFor(() => dao.queryByMultipleHashes(['tag:combo: ramp']));
    const fromTagQuery = await primaryKeyFor(() => dao.queryByTag('combo: ramp'));
    const truncatedTag = await primaryKeyFor(() => dao.queryByTag('combo'));

    expect(fromHashString).toEqual(fromTagQuery);
    expect(fromHashString).not.toEqual(truncatedTag);
  });

  // A single hash short-circuits before the loop that converts every hash, so the branch the
  // search route actually reaches when it combines filters needs its own case.
  it('keeps colons when combining several hash strings', async () => {
    const fromHashString = await primaryKeyFor(() =>
      dao.queryByMultipleHashes(['tag:combo: ramp', 'category:vintage']),
    );
    const fromTagQuery = await primaryKeyFor(() => dao.queryByTag('combo: ramp'));
    const truncatedTag = await primaryKeyFor(() => dao.queryByTag('combo'));

    expect(fromHashString).toEqual(fromTagQuery);
    expect(fromHashString).not.toEqual(truncatedTag);
  });

  it('ignores hash strings that have no type or no value', async () => {
    await expect(dao.queryByMultipleHashes([':ramp'])).resolves.toEqual({ items: [] });
    await expect(dao.queryByMultipleHashes(['tag:'])).resolves.toEqual({ items: [] });
    await expect(dao.queryByMultipleHashes(['tag'])).resolves.toEqual({ items: [] });

    expect(send).not.toHaveBeenCalled();
  });
});
