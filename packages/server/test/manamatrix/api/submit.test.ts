import { ManaMatrixCellStats, ManaMatrixPuzzle, ManaMatrixSubmission } from '@utils/datatypes/ManaMatrix';

import { submitManaMatrixHandler } from '../../../src/router/routes/tool/api/manamatrix/submit';
import { createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../../src/dynamo/daos'),
  manaMatrixPuzzleDao: {
    getByDate: jest.fn(),
  },
  manaMatrixSubmissionDao: {
    getByUserAndDate: jest.fn(),
    createSubmission: jest.fn(),
    update: jest.fn(),
  },
  manaMatrixUserStatsDao: {
    getByUserId: jest.fn(),
    createUserStats: jest.fn(),
    update: jest.fn(),
  },
  manaMatrixCellStatsDao: {
    getForPuzzle: jest.fn(),
    recordAnswer: jest.fn(),
  },
}));

jest.mock('serverutils/manamatrix/validate', () => ({
  validateAnswers: jest.fn(),
}));

jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: {},
  whenCardDbReady: jest.fn().mockResolvedValue(undefined),
}));

import {
  manaMatrixCellStatsDao,
  manaMatrixPuzzleDao,
  manaMatrixSubmissionDao,
  manaMatrixUserStatsDao,
} from '../../../src/dynamo/daos';
import { validateAnswers } from '../../../src/serverutils/manamatrix/validate';

const DATE = '2026-09-24';

const category = (filterText: string) => ({ filterText, description: filterText });

const createPuzzle = (overrides?: Partial<ManaMatrixPuzzle>): ManaMatrixPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  columns: [category('cmc=1'), category('cmc=2'), category('cmc=3')],
  rows: [category('type:creature'), category('type:instant'), category('type:sorcery')],
  counts: [
    [10, 10, 10],
    [10, 10, 10],
    [10, 10, 10],
  ],
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

const grid = <T>(fill: T): T[][] => [
  [fill, fill, fill],
  [fill, fill, fill],
  [fill, fill, fill],
];

const gridWith = <T>(fill: T, entries: [number, number, T][]): T[][] => {
  const result = grid(fill);
  for (const [row, col, value] of entries) {
    result[row]![col] = value;
  }
  return result;
};

const createCellStatsGrid = (): (ManaMatrixCellStats | undefined)[][] =>
  Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, col) => ({
      date: DATE,
      row,
      col,
      totalAnswers: 10,
      answerCounts: { 'grizzly bears': 4 },
      dateCreated: 0,
      dateLastUpdated: 0,
    })),
  );

const createSubmissionRecord = (overrides?: Partial<ManaMatrixSubmission>): ManaMatrixSubmission => ({
  userId: 'user-1',
  date: DATE,
  answers: grid(null),
  correct: grid(false),
  attempts: 1,
  countedCells: {},
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

describe('Submit ManaMatrix API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (manaMatrixPuzzleDao.getByDate as jest.Mock).mockResolvedValue(createPuzzle());
    (manaMatrixCellStatsDao.getForPuzzle as jest.Mock).mockResolvedValue(createCellStatsGrid());
    (manaMatrixCellStatsDao.recordAnswer as jest.Mock).mockResolvedValue(true);
    (manaMatrixSubmissionDao.createSubmission as jest.Mock).mockImplementation(async (doc) => ({
      ...doc,
      dateCreated: 0,
      dateLastUpdated: 0,
    }));
    (validateAnswers as jest.Mock).mockReturnValue({
      correct: gridWith(false, [[0, 0, true]]),
      matchedNames: gridWith<string | null>(null, [[0, 0, 'grizzly bears']]),
      displayNames: gridWith<string | null>(null, [[0, 0, 'Grizzly Bears']]),
    });
  });

  const submitBody = { date: DATE, answers: gridWith('', [[0, 0, 'Grizzly Bears']]) };

  it('returns 404 when the puzzle does not exist', async () => {
    (manaMatrixPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);

    const res = await call(submitManaMatrixHandler).withBody(submitBody).send();

    expect(res.status).toEqual(404);
  });

  it('validates anonymously without persisting anything', async () => {
    const res = await call(submitManaMatrixHandler).withBody(submitBody).send();

    expect(res.status).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.correct[0][0]).toBe(true);
    // Correct answers come back with the canonical printed name.
    expect(res.body.answers[0][0]).toBe('Grizzly Bears');
    expect(res.body.attempts).toBeNull();
    expect(res.body.stats).toBeNull();
    // Popularity still shown for context: 4 of 10 counted answers match.
    expect(res.body.popularity[0][0]).toEqual({ count: 4, total: 10, percentage: 40 });

    expect(manaMatrixSubmissionDao.createSubmission).not.toHaveBeenCalled();
    expect(manaMatrixSubmissionDao.update).not.toHaveBeenCalled();
    expect(manaMatrixCellStatsDao.recordAnswer).not.toHaveBeenCalled();
    expect(manaMatrixUserStatsDao.createUserStats).not.toHaveBeenCalled();
  });

  it('creates a submission, counts popularity, and starts a streak on first play', async () => {
    const user = createUser({ id: 'user-1' });
    (manaMatrixSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);
    (manaMatrixUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(undefined);

    const res = await call(submitManaMatrixHandler).as(user).withBody(submitBody).send();

    expect(res.status).toEqual(200);
    expect(res.body.attempts).toEqual(1);

    expect(manaMatrixCellStatsDao.recordAnswer).toHaveBeenCalledTimes(1);
    expect(manaMatrixCellStatsDao.recordAnswer).toHaveBeenCalledWith(DATE, 0, 0, 'grizzly bears');

    expect(manaMatrixSubmissionDao.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        date: DATE,
        attempts: 1,
        countedCells: { '0,0': 'grizzly bears' },
      }),
    );

    expect(manaMatrixUserStatsDao.createUserStats).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        currentStreak: 1,
        longestStreak: 1,
        lastPlayedDate: DATE,
        totalPlayed: 1,
        totalCellsCorrect: 1,
        perfectDays: 0,
      }),
    );
  });

  it('merges attempts, keeps solved cells, and only counts new cells once', async () => {
    const user = createUser({ id: 'user-1' });
    (manaMatrixSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(
      createSubmissionRecord({
        correct: gridWith(false, [[0, 0, true]]),
        answers: gridWith<string | null>(null, [[0, 0, 'Grizzly Bears']]),
        countedCells: { '0,0': 'grizzly bears' },
      }),
    );
    (manaMatrixUserStatsDao.getByUserId as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      currentStreak: 1,
      longestStreak: 1,
      lastPlayedDate: DATE,
      totalPlayed: 1,
      totalCellsCorrect: 1,
      perfectDays: 0,
      dateCreated: 0,
      dateLastUpdated: 0,
    });
    // Second attempt: cell (0,0) answer was changed to something wrong, but a
    // new cell (1,1) is now correct.
    (validateAnswers as jest.Mock).mockReturnValue({
      correct: gridWith(false, [[1, 1, true]]),
      matchedNames: gridWith<string | null>(null, [[1, 1, 'lightning bolt']]),
      displayNames: gridWith<string | null>(null, [[1, 1, 'Lightning Bolt']]),
    });

    const res = await call(submitManaMatrixHandler)
      .as(user)
      .withBody({ date: DATE, answers: gridWith('', [[1, 1, 'Lightning Bolt']]) })
      .send();

    expect(res.status).toEqual(200);
    expect(res.body.attempts).toEqual(2);
    // Previously solved cell stays solved even though this attempt "lost" it.
    expect(res.body.correct[0][0]).toBe(true);
    expect(res.body.correct[1][1]).toBe(true);

    // Only the newly solved cell is counted; (0,0) was already counted.
    expect(manaMatrixCellStatsDao.recordAnswer).toHaveBeenCalledTimes(1);
    expect(manaMatrixCellStatsDao.recordAnswer).toHaveBeenCalledWith(DATE, 1, 1, 'lightning bolt');

    // Not a first submission: streak fields untouched, but cell total moved.
    expect(manaMatrixUserStatsDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ currentStreak: 1, totalPlayed: 1, totalCellsCorrect: 2 }),
    );
  });

  it('extends the streak when the previous play was yesterday', async () => {
    const user = createUser({ id: 'user-1' });
    (manaMatrixSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);
    (manaMatrixUserStatsDao.getByUserId as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      currentStreak: 3,
      longestStreak: 5,
      lastPlayedDate: '2026-09-23',
      totalPlayed: 10,
      totalCellsCorrect: 50,
      perfectDays: 2,
      dateCreated: 0,
      dateLastUpdated: 0,
    });

    const res = await call(submitManaMatrixHandler).as(user).withBody(submitBody).send();

    expect(res.status).toEqual(200);
    expect(manaMatrixUserStatsDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ currentStreak: 4, longestStreak: 5, lastPlayedDate: DATE, totalPlayed: 11 }),
    );
  });

  it('resets the streak after a gap', async () => {
    const user = createUser({ id: 'user-1' });
    (manaMatrixSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);
    (manaMatrixUserStatsDao.getByUserId as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      currentStreak: 3,
      longestStreak: 5,
      lastPlayedDate: '2026-09-20',
      totalPlayed: 10,
      totalCellsCorrect: 50,
      perfectDays: 2,
      dateCreated: 0,
      dateLastUpdated: 0,
    });

    await call(submitManaMatrixHandler).as(user).withBody(submitBody).send();

    expect(manaMatrixUserStatsDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ currentStreak: 1, longestStreak: 5, lastPlayedDate: DATE }),
    );
  });

  it('does not move the streak for archive puzzles', async () => {
    const user = createUser({ id: 'user-1' });
    (manaMatrixPuzzleDao.getByDate as jest.Mock).mockResolvedValue(createPuzzle({ isActive: false }));
    (manaMatrixSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);
    (manaMatrixUserStatsDao.getByUserId as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      currentStreak: 3,
      longestStreak: 5,
      lastPlayedDate: '2026-09-23',
      totalPlayed: 10,
      totalCellsCorrect: 50,
      perfectDays: 2,
      dateCreated: 0,
      dateLastUpdated: 0,
    });

    await call(submitManaMatrixHandler).as(user).withBody(submitBody).send();

    expect(manaMatrixUserStatsDao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStreak: 3,
        lastPlayedDate: '2026-09-23',
        totalPlayed: 11,
        totalCellsCorrect: 51,
      }),
    );
  });

  it('marks completion and a perfect day when all nine cells are solved', async () => {
    const user = createUser({ id: 'user-1' });
    (manaMatrixSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);
    (manaMatrixUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(undefined);
    (validateAnswers as jest.Mock).mockReturnValue({
      correct: grid(true),
      matchedNames: grid<string | null>('grizzly bears'),
      displayNames: grid<string | null>('Grizzly Bears'),
    });

    const res = await call(submitManaMatrixHandler)
      .as(user)
      .withBody({ date: DATE, answers: grid('Grizzly Bears') })
      .send();

    expect(res.status).toEqual(200);
    expect(res.body.completedAt).not.toBeNull();
    expect(manaMatrixCellStatsDao.recordAnswer).toHaveBeenCalledTimes(9);
    expect(manaMatrixUserStatsDao.createUserStats).toHaveBeenCalledWith(
      expect.objectContaining({ perfectDays: 1, totalCellsCorrect: 9 }),
    );
  });
});
