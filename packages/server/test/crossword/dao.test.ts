import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { CrosswordPuzzle, CrosswordSubmission, CrosswordUserStats } from '@utils/datatypes/Crossword';

import { CrosswordPuzzleDynamoDao } from '../../src/dynamo/dao/CrosswordPuzzleDynamoDao';
import { CrosswordSubmissionDynamoDao } from '../../src/dynamo/dao/CrosswordSubmissionDynamoDao';
import { CrosswordUserStatsDynamoDao } from '../../src/dynamo/dao/CrosswordUserStatsDynamoDao';

const TABLE = 'TEST_TABLE';
const DATE = '2026-09-28';

const grid = (): CrosswordPuzzle['grid'] => ({
  width: 3,
  height: 3,
  blockCount: 0,
  blocks: [
    [false, false, false],
    [false, false, false],
    [false, false, false],
  ],
  letters: [
    ['C', 'A', 'T'],
    ['A', 'R', 'E'],
    ['T', 'E', 'N'],
  ],
  slots: [
    {
      id: 'a-0-0',
      direction: 'across',
      row: 0,
      col: 0,
      length: 3,
      number: 1,
      entry: { text: 'CAT', display: 'Felidae', entryClass: 'nameWord' },
      clue: 'Purring pet',
    },
  ],
});

const puzzle = (overrides?: Partial<CrosswordPuzzle>): CrosswordPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  grid: grid(),
  isActive: true,
  dateCreated: 1,
  dateLastUpdated: 1,
  ...overrides,
});

/** A stored row as Dynamo hands it back. */
const stored = <T>(item: T, keys: Record<string, any> = {}) => ({ ...keys, DynamoVersion: 3, item });

describe('CrosswordPuzzleDynamoDao', () => {
  let send: jest.Mock;
  let dao: CrosswordPuzzleDynamoDao;

  beforeEach(() => {
    jest.clearAllMocks();
    send = jest.fn(async () => ({}));
    dao = new CrosswordPuzzleDynamoDao({ send } as any, TABLE);
  });

  const commands = (type: any) => send.mock.calls.map(([command]) => command).filter((c: any) => c instanceof type);

  it('keys a puzzle by its date, with the archive and active indexes', async () => {
    await dao.put(puzzle());

    const item = commands(PutCommand)[0]!.input.Item!;
    expect(item.PK).toEqual(`CROSSWORD_PUZZLE#${DATE}`);
    expect(item.SK).toEqual('CROSSWORD_PUZZLE');
    // GSI1 is the archive, newest first; GSI2 is "which one is today's".
    expect(item.GSI1PK).toEqual('CROSSWORD_PUZZLE#TYPE#HISTORY');
    expect(item.GSI1SK).toEqual(`DATE#${DATE}`);
    expect(item.GSI2PK).toEqual('CROSSWORD_PUZZLE#ACTIVE');
    expect(item.GSI2SK).toEqual(`DATE#${DATE}`);
    expect(item.item).toMatchObject({ date: DATE, isActive: true });
  });

  it('leaves the active index empty for an archived puzzle', async () => {
    await dao.put(puzzle({ isActive: false }));

    const item = commands(PutCommand)[0]!.input.Item!;
    expect(item.GSI2PK).toBeUndefined();
    expect(item.GSI2SK).toBeUndefined();
  });

  it('reads a puzzle by date off the primary key', async () => {
    send.mockResolvedValue({ Item: stored(puzzle()) });

    const found = await dao.getByDate(DATE);

    expect(commands(GetCommand)[0]!.input.Key).toEqual({
      PK: `CROSSWORD_PUZZLE#${DATE}`,
      SK: 'CROSSWORD_PUZZLE',
    });
    expect(found?.date).toEqual(DATE);
  });

  it('finds the active puzzle through GSI2', async () => {
    send.mockResolvedValue({ Items: [stored(puzzle())] });

    const found = await dao.getActive();

    const query = commands(QueryCommand)[0]!.input;
    expect(query.IndexName).toEqual('GSI2');
    expect(query.ExpressionAttributeValues).toEqual({ ':active': 'CROSSWORD_PUZZLE#ACTIVE' });
    expect(query.ScanIndexForward).toBe(false);
    expect(query.Limit).toEqual(1);
    expect(found?.date).toEqual(DATE);
  });

  it('returns undefined when no puzzle is active', async () => {
    send.mockResolvedValue({ Items: [] });

    expect(await dao.getActive()).toBeUndefined();
  });

  it('pages the archive newest first through GSI1', async () => {
    send.mockResolvedValue({ Items: [stored(puzzle())], LastEvaluatedKey: { PK: 'x' } });

    const result = await dao.getHistory(undefined, 5);

    const query = commands(QueryCommand)[0]!.input;
    expect(query.IndexName).toEqual('GSI1');
    expect(query.ExpressionAttributeValues).toEqual({ ':type': 'CROSSWORD_PUZZLE#TYPE#HISTORY' });
    expect(query.ScanIndexForward).toBe(false);
    expect(query.Limit).toEqual(5);
    expect(result.items).toHaveLength(1);
    expect(result.lastKey).toEqual({ PK: 'x' });
  });

  it('deactivates the previous day when activating a new puzzle', async () => {
    const yesterday = puzzle({ id: '2026-09-27', date: '2026-09-27' });
    send.mockImplementation(async (command: any) => {
      if (command instanceof QueryCommand) {
        return { Items: [stored(yesterday)] };
      }
      if (command instanceof GetCommand) {
        return { Item: stored(yesterday) };
      }
      return {};
    });

    const created = await dao.setActivePuzzle({ date: DATE, grid: grid(), isActive: true });

    expect(created.id).toEqual(DATE);
    expect(created.type).toEqual('HISTORY');
    expect(created.isActive).toBe(true);

    const written = commands(PutCommand).map((command: any) => command.input.Item!);
    // Yesterday goes inactive, today goes in active.
    expect(written.find((item: any) => item.item.date === '2026-09-27')!.item.isActive).toBe(false);
    expect(written.find((item: any) => item.item.date === DATE)!.GSI2PK).toEqual('CROSSWORD_PUZZLE#ACTIVE');
  });

  it('does not rewrite the active puzzle when re-activating the same date', async () => {
    send.mockImplementation(async (command: any) =>
      command instanceof QueryCommand ? { Items: [stored(puzzle())] } : {},
    );

    await dao.setActivePuzzle({ date: DATE, grid: grid(), isActive: true });

    expect(commands(PutCommand)).toHaveLength(1);
  });
});

describe('CrosswordSubmissionDynamoDao', () => {
  let send: jest.Mock;
  let dao: CrosswordSubmissionDynamoDao;

  const submission = (overrides?: Partial<CrosswordSubmission>): CrosswordSubmission => ({
    userId: 'user-1',
    date: DATE,
    startedAt: 1000,
    attempts: 0,
    checks: 0,
    reveals: 0,
    solved: false,
    dateCreated: 1,
    dateLastUpdated: 1,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    send = jest.fn(async () => ({}));
    dao = new CrosswordSubmissionDynamoDao({ send } as any, TABLE);
  });

  const commands = (type: any) => send.mock.calls.map(([command]) => command).filter((c: any) => c instanceof type);

  it('keys one run per user per date, indexed by user', async () => {
    await dao.put(submission());

    const item = commands(PutCommand)[0]!.input.Item!;
    expect(item.PK).toEqual(`CROSSWORD_SUBMISSION#user-1#${DATE}`);
    expect(item.SK).toEqual('CROSSWORD_SUBMISSION');
    expect(item.GSI1PK).toEqual('CROSSWORD_SUBMISSION#USER#user-1');
    expect(item.GSI1SK).toEqual(`DATE#${DATE}`);
  });

  it('stores the clock and the counters', async () => {
    await dao.put(
      submission({
        startedAt: 5000,
        attempts: 2,
        checks: 1,
        reveals: 3,
        solved: true,
        completionTimeMs: 61_000,
        completedAt: 66_000,
      }),
    );

    expect(commands(PutCommand)[0]!.input.Item!.item).toEqual(
      expect.objectContaining({
        startedAt: 5000,
        attempts: 2,
        checks: 1,
        reveals: 3,
        solved: true,
        completionTimeMs: 61_000,
        completedAt: 66_000,
      }),
    );
  });

  it('reads a run by user and date', async () => {
    send.mockResolvedValue({ Item: stored(submission()) });

    const found = await dao.getByUserAndDate('user-1', DATE);

    expect(commands(GetCommand)[0]!.input.Key).toEqual({
      PK: `CROSSWORD_SUBMISSION#user-1#${DATE}`,
      SK: 'CROSSWORD_SUBMISSION',
    });
    expect(found?.userId).toEqual('user-1');
  });

  it('pages a user history newest first', async () => {
    send.mockResolvedValue({ Items: [stored(submission())] });

    await dao.getUserHistory('user-1', { PK: 'cursor' }, 7);

    const query = commands(QueryCommand)[0]!.input;
    expect(query.IndexName).toEqual('GSI1');
    expect(query.ExpressionAttributeValues).toEqual({ ':user': 'CROSSWORD_SUBMISSION#USER#user-1' });
    expect(query.ScanIndexForward).toBe(false);
    expect(query.Limit).toEqual(7);
    expect(query.ExclusiveStartKey).toEqual({ PK: 'cursor' });
  });

  it('stamps creation timestamps on a new run', async () => {
    const created = await dao.createSubmission({
      userId: 'user-1',
      date: DATE,
      startedAt: 1000,
      attempts: 0,
      checks: 0,
      reveals: 0,
      solved: false,
    });

    expect(created.dateCreated).toBeGreaterThan(0);
    expect(created.dateLastUpdated).toEqual(created.dateCreated);
    expect(commands(PutCommand)).toHaveLength(1);
  });
});

describe('CrosswordUserStatsDynamoDao', () => {
  let send: jest.Mock;
  let dao: CrosswordUserStatsDynamoDao;

  const stats = (overrides?: Partial<CrosswordUserStats>): CrosswordUserStats => ({
    userId: 'user-1',
    currentStreak: 2,
    longestStreak: 4,
    lastPlayedDate: DATE,
    totalPlayed: 9,
    totalSolved: 6,
    perfectDays: 3,
    bestTimeMs: 90_000,
    dateCreated: 1,
    dateLastUpdated: 1,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    send = jest.fn(async () => ({}));
    dao = new CrosswordUserStatsDynamoDao({ send } as any, TABLE);
  });

  const commands = (type: any) => send.mock.calls.map(([command]) => command).filter((c: any) => c instanceof type);

  it('keys one stats row per user with no secondary indexes', async () => {
    await dao.put(stats());

    const item = commands(PutCommand)[0]!.input.Item!;
    expect(item.PK).toEqual('CROSSWORD_USER_STATS#user-1');
    expect(item.SK).toEqual('CROSSWORD_USER_STATS');
    expect(item.GSI1PK).toBeUndefined();
    expect(item.GSI2PK).toBeUndefined();
  });

  it('round-trips every stat, best time included', async () => {
    await dao.put(stats());

    expect(commands(PutCommand)[0]!.input.Item!.item).toEqual(
      expect.objectContaining({
        currentStreak: 2,
        longestStreak: 4,
        lastPlayedDate: DATE,
        totalPlayed: 9,
        totalSolved: 6,
        perfectDays: 3,
        bestTimeMs: 90_000,
      }),
    );
  });

  it('reads stats by user id', async () => {
    send.mockResolvedValue({ Item: stored(stats()) });

    const found = await dao.getByUserId('user-1');

    expect(commands(GetCommand)[0]!.input.Key).toEqual({
      PK: 'CROSSWORD_USER_STATS#user-1',
      SK: 'CROSSWORD_USER_STATS',
    });
    expect(found?.currentStreak).toEqual(2);
  });
});
