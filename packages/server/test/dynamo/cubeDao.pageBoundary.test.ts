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

import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';
import { createCube, createUser } from '../test-utils/data';

const TABLE = 'TEST_TABLE';

// DynamoDB caps a page by payload size, not by the requested Limit, so a query that asks for 108 rows
// routinely comes back with fewer and a LastEvaluatedKey. That is exactly the shape that makes the DAO
// loop accumulate more matches than the caller asked for.
const DYNAMO_PAGE_SIZE = 50;
const CARD_COUNT_FILTER = { operator: 'gt' as const, value: 100 };

const owner = createUser();

/** Every fifth cube misses the card count filter, so each 50-row scan yields 40 matches. */
const isMatch = (index: number) => index % 5 !== 4;

describe('CubeDynamoDao hash query page boundary', () => {
  let send: jest.Mock;
  let dao: CubeDynamoDao;
  let rows: { PK: string; SK: string }[];

  /**
   * Stands up a fake table of `total` hash rows and wires `send` to serve both the GSI query and the
   * per-cube hydration gets from it.
   */
  const seedTable = (total: number) => {
    rows = Array.from({ length: total }, (_, index) => ({
      PK: `HASH#CUBE#cube-${index}`,
      SK: `HASH#${String(index).padStart(4, '0')}`,
    }));

    const cubesById = new Map(
      rows.map((row, index) => {
        const id = row.PK.replace('HASH#CUBE#', '');
        const {
          owner: _owner,
          image: _image,
          ...cube
        } = createCube({
          id,
          name: `Cube ${index}`,
          cardCount: isMatch(index) ? 400 : 10,
        });
        return [id, { ...cube, owner: owner.id }];
      }),
    );

    send = jest.fn(async (command: any) => {
      if (command instanceof QueryCommand) {
        const startKey = command.input.ExclusiveStartKey;
        const start = startKey ? rows.findIndex((row) => row.PK === startKey.PK) + 1 : 0;
        const pageSize = Math.min(command.input.Limit ?? DYNAMO_PAGE_SIZE, DYNAMO_PAGE_SIZE);
        const page = rows.slice(start, start + pageSize);
        const end = start + page.length;

        return {
          Items: page,
          LastEvaluatedKey: end < rows.length ? rows[end - 1] : undefined,
        };
      }

      if (command instanceof GetCommand) {
        const id = String(command.input.Key?.PK).replace('CUBE#', '');
        const cube = cubesById.get(id);
        return cube ? { Item: { PK: command.input.Key?.PK, SK: 'CUBE', DynamoVersion: 1, item: cube } } : {};
      }

      return {};
    });

    const userDao = { getById: jest.fn(async () => owner), batchGet: jest.fn(async () => [owner]) };
    dao = new CubeDynamoDao({ send } as any, userDao as any, TABLE);
  };

  const matchingIdsInOrder = () =>
    rows.filter((_row, index) => isMatch(index)).map((row) => row.PK.replace('HASH#CUBE#', ''));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The loop over-fetches because the card count filter runs after the query, so it routinely holds more
  // matches than the caller asked for. Slicing those away while returning a cursor past everything scanned
  // makes the surplus unreachable from any page.
  it('returns every match it accumulated rather than slicing some away', async () => {
    seedTable(150);

    const result = await dao.queryByFeatured('popularity', false, undefined, 36, CARD_COUNT_FILTER);

    expect(result.items).toHaveLength(40);
    expect(result.items.map((cube) => cube.id)).toEqual(matchingIdsInOrder().slice(0, 40));
  });

  // This is the one that pins the bug: walking the cursor must visit every match exactly once. If the page
  // is truncated but the cursor still points past everything scanned, the trimmed cubes land in neither page.
  it('pairs the returned cursor with the records it actually returned', async () => {
    seedTable(150);

    const firstPage = await dao.queryByFeatured('popularity', false, undefined, 36, CARD_COUNT_FILTER);
    expect(firstPage.lastKey).toBeDefined();

    const secondPage = await dao.queryByFeatured('popularity', false, firstPage.lastKey, 36, CARD_COUNT_FILTER);

    const seen = [...firstPage.items, ...secondPage.items].map((cube) => cube.id);
    expect(seen).toEqual(matchingIdsInOrder().slice(0, seen.length));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('returns no cursor when DynamoDB reports exhaustion', async () => {
    seedTable(20);

    const result = await dao.queryByFeatured('popularity', false, undefined, 36, CARD_COUNT_FILTER);

    expect(result.lastKey).toBeUndefined();
    expect(result.items.map((cube) => cube.id)).toEqual(matchingIdsInOrder());
  });
});
