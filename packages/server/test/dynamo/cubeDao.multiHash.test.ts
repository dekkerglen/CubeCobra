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

import { createHash } from 'crypto';

import { BatchGetCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';
import { createCube, createUser } from '../test-utils/data';

const TABLE = 'TEST_TABLE';

// The DAO scans at most 10 candidate pages before giving up; the guard is what keeps a sparse
// multi-token search off the 30s request timeout.
const MAX_PAGES = 10;

// A cube holds one hash row per mainboard card, so its hash partition is far bigger than a single
// DynamoDB page. Three rows per page keeps that shape in the fake table without 400 fixtures.
const HASH_PAGE_SIZE = 3;

const owner = createUser();

/** Mirrors BaseDynamoDao.hash: sha256 over sorted `key:value` pairs, with the item type folded in. */
const hashFor = (type: string, value: string): string =>
  createHash('sha256')
    .update([`ItemType:CUBE`, `type:${type}`, `value:${value}`].sort().join(','))
    .digest('hex');

const PRIMARY_TOKEN = 'tag:vintage';
const REQUIRED_TOKEN = 'tag:powered';
const PRIMARY_HASH = hashFor('tag', 'vintage');
const REQUIRED_HASH = hashFor('tag', 'powered');

interface TableModel {
  /** Candidate cube ids returned by the primary hash GSI query, in page order. */
  candidateIds: string[];
  /** Every hash row SK present on each cube's `HASH#CUBE#{id}` partition, in SK order. */
  hashesByCube: Map<string, string[]>;
}

describe('CubeDynamoDao multi-hash search', () => {
  let send: jest.Mock;
  let dao: CubeDynamoDao;

  const buildDao = (model: TableModel) => {
    const cubesById = new Map(
      model.candidateIds.map((id) => {
        const { owner: _owner, image: _image, ...cube } = createCube({ id, name: `Cube ${id}`, cardCount: 400 });
        return [id, { ...cube, owner: owner.id }];
      }),
    );

    send = jest.fn(async (command: any) => {
      if (command instanceof QueryCommand) {
        const input = command.input;

        // Candidate page from the primary hash, one cube id per page so the page count is readable.
        if (input.IndexName) {
          const start = input.ExclusiveStartKey ? model.candidateIds.indexOf(input.ExclusiveStartKey.cubeId) + 1 : 0;
          const id = model.candidateIds[start];

          if (id === undefined) {
            return { Items: [] };
          }

          return {
            Items: [{ PK: `HASH#CUBE#${id}`, SK: PRIMARY_HASH }],
            LastEvaluatedKey: start + 1 < model.candidateIds.length ? { cubeId: id } : undefined,
          };
        }

        // Every hash row on one cube's partition. DynamoDB caps the page by payload size, so a big
        // cube's hashes arrive across several pages with a LastEvaluatedKey between them.
        const cubeId = String(input.ExpressionAttributeValues?.[':pk']).replace('HASH#CUBE#', '');
        const hashes = model.hashesByCube.get(cubeId) ?? [];
        const start = input.ExclusiveStartKey ? hashes.indexOf(input.ExclusiveStartKey.SK) + 1 : 0;
        const page = hashes.slice(start, start + HASH_PAGE_SIZE);
        const end = start + page.length;

        return {
          Items: page.map((hash) => ({ PK: `HASH#CUBE#${cubeId}`, SK: hash })),
          LastEvaluatedKey: end < hashes.length ? { PK: `HASH#CUBE#${cubeId}`, SK: hashes[end - 1] } : undefined,
        };
      }

      // Point lookups of specific hash rows: present means the cube carries that hash.
      if (command instanceof BatchGetCommand) {
        const keys = command.input.RequestItems?.[TABLE]?.Keys ?? [];
        const found = keys.filter((key: any) => {
          const cubeId = String(key.PK).replace('HASH#CUBE#', '');
          return (model.hashesByCube.get(cubeId) ?? []).includes(key.SK);
        });

        return { Responses: { [TABLE]: found.map((key: any) => ({ PK: key.PK, SK: key.SK })) } };
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

  /** A candidate page whose cubes carry the primary hash but never the required one. */
  const buildNonMatchingModel = (candidateCount: number): TableModel => {
    const candidateIds = Array.from({ length: candidateCount }, (_, index) => `cube-${index}`);

    return {
      candidateIds,
      hashesByCube: new Map(candidateIds.map((id) => [id, [PRIMARY_HASH]])),
    };
  };

  const candidatePageQueries = () =>
    send.mock.calls.map(([command]) => command).filter((command: any) => command.input?.IndexName);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The membership test used to read the candidate's whole hash set in one unpaginated query and
  // ignore its LastEvaluatedKey, so on a cube big enough to span pages the required hash was simply
  // cut off and the cube silently vanished from the results.
  it('matches a cube whose hash set spans more than one DynamoDB page', async () => {
    const filler = Array.from({ length: 20 }, (_, index) => hashFor('oracle', `card-${index}`));

    buildDao({
      candidateIds: ['big-cube'],
      // The required hash sits well past the first page of the partition.
      hashesByCube: new Map([['big-cube', [PRIMARY_HASH, ...filler.slice(0, 10), REQUIRED_HASH, ...filler.slice(10)]]]),
    });

    const result = await dao.queryByMultipleHashes([PRIMARY_TOKEN, REQUIRED_TOKEN]);

    expect(result.items.map((cube) => cube.id)).toEqual(['big-cube']);
  });

  it('matches a cube whose required hash is on the first page', async () => {
    buildDao({
      candidateIds: ['small-cube'],
      hashesByCube: new Map([['small-cube', [PRIMARY_HASH, REQUIRED_HASH]]]),
    });

    const result = await dao.queryByMultipleHashes([PRIMARY_TOKEN, REQUIRED_TOKEN]);

    expect(result.items.map((cube) => cube.id)).toEqual(['small-cube']);
  });

  it('reports exhaustion instead of throwing when no match is found', async () => {
    buildDao(buildNonMatchingModel(MAX_PAGES + 5));

    const result = await dao.queryByMultipleHashes([PRIMARY_TOKEN, REQUIRED_TOKEN]);

    expect(result.items).toEqual([]);
    expect(result.lastKey).toBeUndefined();
  });

  it('does not reject on a Next click deep into a sparse search', async () => {
    buildDao(buildNonMatchingModel(MAX_PAGES * 3));

    const result = await dao.queryByMultipleHashes(
      [PRIMARY_TOKEN, REQUIRED_TOKEN],
      'popularity',
      false,
      { cubeId: 'cube-0' },
      undefined,
    );

    expect(result.items).toEqual([]);
    expect(result.lastKey).toBeUndefined();
  });

  it('still stops scanning after MAX_PAGES', async () => {
    buildDao(buildNonMatchingModel(MAX_PAGES * 5));

    await dao.queryByMultipleHashes([PRIMARY_TOKEN, REQUIRED_TOKEN]);

    expect(candidatePageQueries()).toHaveLength(MAX_PAGES);
  });

  it('stops early and returns no cursor when the primary hash runs out of candidates', async () => {
    buildDao(buildNonMatchingModel(3));

    const result = await dao.queryByMultipleHashes([PRIMARY_TOKEN, REQUIRED_TOKEN]);

    expect(candidatePageQueries()).toHaveLength(3);
    expect(result.items).toEqual([]);
    expect(result.lastKey).toBeUndefined();
  });

  it('returns the cursor past the page it matched on so the next page resumes after it', async () => {
    const candidateIds = ['cube-0', 'cube-1', 'cube-2'];

    buildDao({
      candidateIds,
      hashesByCube: new Map([
        ['cube-0', [PRIMARY_HASH]],
        ['cube-1', [PRIMARY_HASH, REQUIRED_HASH]],
        ['cube-2', [PRIMARY_HASH, REQUIRED_HASH]],
      ]),
    });

    const result = await dao.queryByMultipleHashes([PRIMARY_TOKEN, REQUIRED_TOKEN]);

    expect(result.items.map((cube) => cube.id)).toEqual(['cube-1']);
    expect(result.lastKey).toEqual({ cubeId: 'cube-1' });
  });

  // The cost of the membership test is what made the old shape truncate. It must stay proportional to
  // the number of filter hashes, never to how many cards the candidate holds.
  it('reads only the hashes it is filtering on, not the cube’s whole hash set', async () => {
    const filler = Array.from({ length: 40 }, (_, index) => hashFor('oracle', `card-${index}`));

    buildDao({
      candidateIds: ['big-cube'],
      hashesByCube: new Map([['big-cube', [PRIMARY_HASH, ...filler, REQUIRED_HASH]]]),
    });

    await dao.queryByMultipleHashes([PRIMARY_TOKEN, REQUIRED_TOKEN]);

    const partitionScans = send.mock.calls
      .map(([command]) => command)
      .filter(
        (command: any) =>
          command instanceof QueryCommand &&
          !command.input.IndexName &&
          String(command.input.ExpressionAttributeValues?.[':pk']).startsWith('HASH#CUBE#'),
      );
    const requestedKeys = send.mock.calls
      .map(([command]) => command)
      .filter((command: any) => command instanceof BatchGetCommand)
      .flatMap((command: any) => command.input.RequestItems[TABLE].Keys);

    expect(partitionScans).toHaveLength(0);
    expect(requestedKeys).toEqual([{ PK: 'HASH#CUBE#big-cube', SK: REQUIRED_HASH }]);
  });

  // An unprocessed key is throttling, not absence: reading it as "cube lacks the hash" would hide the
  // cube exactly the way the truncated read did.
  it('retries keys DynamoDB leaves unprocessed instead of counting them as misses', async () => {
    buildDao({
      candidateIds: ['cube-0'],
      hashesByCube: new Map([['cube-0', [PRIMARY_HASH, REQUIRED_HASH]]]),
    });

    const realSend = send.getMockImplementation()!;
    let deferred = false;
    send.mockImplementation(async (command: any) => {
      if (command instanceof BatchGetCommand && !deferred) {
        deferred = true;
        const request = (command.input.RequestItems ?? {})[TABLE];
        return { Responses: { [TABLE]: [] }, UnprocessedKeys: { [TABLE]: request } };
      }
      return realSend(command);
    });

    const result = await dao.queryByMultipleHashes([PRIMARY_TOKEN, REQUIRED_TOKEN]);

    expect(deferred).toBe(true);
    expect(result.items.map((cube) => cube.id)).toEqual(['cube-0']);
  });
});
