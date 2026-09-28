import { CrosswordPuzzle, CrosswordSubmission, CrosswordUserStats } from '@utils/datatypes/Crossword';

jest.mock('../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../src/dynamo/daos'),
  crosswordSubmissionDao: { getByUserAndDate: jest.fn(), createSubmission: jest.fn(), update: jest.fn() },
  crosswordUserStatsDao: { getByUserId: jest.fn(), createUserStats: jest.fn(), update: jest.fn() },
}));

import { crosswordSubmissionDao, crosswordUserStatsDao } from '../../src/dynamo/daos';
import { recordAction, startSession } from '../../src/serverutils/crossword/daily';

const DATE = '2026-09-28';
const YESTERDAY = '2026-09-27';

const NOW = 1_800_000_000_000;
const STARTED_AT = NOW - 125_000; // Two minutes and five seconds ago.

const createPuzzle = (overrides?: Partial<CrosswordPuzzle>): CrosswordPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  grid: { width: 1, height: 1, blockCount: 0, blocks: [[false]], letters: [['A']], slots: [] },
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

const createSubmission = (overrides?: Partial<CrosswordSubmission>): CrosswordSubmission => ({
  userId: 'user-1',
  date: DATE,
  startedAt: STARTED_AT,
  attempts: 0,
  checks: 0,
  reveals: 0,
  solved: false,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

const createStats = (overrides?: Partial<CrosswordUserStats>): CrosswordUserStats => ({
  userId: 'user-1',
  currentStreak: 0,
  longestStreak: 0,
  lastPlayedDate: undefined,
  totalPlayed: 0,
  totalSolved: 0,
  perfectDays: 0,
  bestTimeMs: undefined,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

describe('crossword daily scorekeeping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    (crosswordSubmissionDao.createSubmission as jest.Mock).mockImplementation(async (doc) => ({
      ...doc,
      dateCreated: NOW,
      dateLastUpdated: NOW,
    }));
    (crosswordUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('startSession', () => {
    it('starts the clock on the first look at a puzzle', async () => {
      (crosswordSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);

      const session = await startSession('user-1', DATE);

      expect(crosswordSubmissionDao.createSubmission).toHaveBeenCalledWith({
        userId: 'user-1',
        date: DATE,
        startedAt: NOW,
        attempts: 0,
        checks: 0,
        reveals: 0,
        solved: false,
      });
      expect(session.startedAt).toEqual(NOW);
    });

    // The clock can only ever be started once, which is what makes the recorded
    // time a real duration rather than a claim.
    it('never restarts the clock on a later visit', async () => {
      const existing = createSubmission({ startedAt: 42 });
      (crosswordSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(existing);

      const session = await startSession('user-1', DATE);

      expect(session.startedAt).toEqual(42);
      expect(crosswordSubmissionDao.createSubmission).not.toHaveBeenCalled();
    });
  });

  describe('recordAction counters', () => {
    it('charges a check against both attempts and checks', async () => {
      const { submission } = await recordAction(createPuzzle(), createSubmission(), 'check', false);

      expect(submission).toMatchObject({ attempts: 1, checks: 1, reveals: 0 });
      expect(crosswordSubmissionDao.update).toHaveBeenCalledWith(expect.objectContaining({ checks: 1 }));
    });

    it('charges a reveal without spending an attempt', async () => {
      const { submission } = await recordAction(createPuzzle(), createSubmission(), 'reveal', false);

      expect(submission).toMatchObject({ attempts: 0, checks: 0, reveals: 1 });
    });

    it('lets a submit through free of charge', async () => {
      const { submission } = await recordAction(createPuzzle(), createSubmission(), 'submit', false);

      expect(submission).toMatchObject({ attempts: 1, checks: 0, reveals: 0 });
    });
  });

  describe('completion time', () => {
    it('is measured from the stored start, not from anything a client sent', async () => {
      const { submission, justSolved } = await recordAction(createPuzzle(), createSubmission(), 'submit', true);

      expect(justSolved).toBe(true);
      expect(submission.solved).toBe(true);
      expect(submission.completionTimeMs).toEqual(125_000);
      expect(submission.completedAt).toEqual(NOW);
    });

    it('keeps the time from the first solve when the puzzle is revisited', async () => {
      const already = createSubmission({ solved: true, completionTimeMs: 60_000, completedAt: NOW - 1000 });

      const { submission, justSolved } = await recordAction(createPuzzle(), already, 'submit', true);

      expect(justSolved).toBe(false);
      expect(submission.completionTimeMs).toEqual(60_000);
      expect(submission.completedAt).toEqual(NOW - 1000);
    });

    it('never records a negative duration', async () => {
      const fromTheFuture = createSubmission({ startedAt: NOW + 5000 });

      const { submission } = await recordAction(createPuzzle(), fromTheFuture, 'submit', true);

      expect(submission.completionTimeMs).toEqual(0);
    });
  });

  describe('streaks', () => {
    it('starts a streak on the first action of the active day', async () => {
      await recordAction(createPuzzle(), createSubmission(), 'check', false);

      expect(crosswordUserStatsDao.createUserStats).toHaveBeenCalledWith(
        expect.objectContaining({ currentStreak: 1, longestStreak: 1, totalPlayed: 1, lastPlayedDate: DATE }),
      );
    });

    it('extends a streak from the previous day', async () => {
      (crosswordUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(
        createStats({ currentStreak: 3, longestStreak: 3, lastPlayedDate: YESTERDAY, totalPlayed: 3 }),
      );

      await recordAction(createPuzzle(), createSubmission(), 'check', false);

      expect(crosswordUserStatsDao.update).toHaveBeenCalledWith(
        expect.objectContaining({ currentStreak: 4, longestStreak: 4, lastPlayedDate: DATE }),
      );
    });

    it('resets a streak after a missed day, keeping the best', async () => {
      (crosswordUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(
        createStats({ currentStreak: 6, longestStreak: 9, lastPlayedDate: '2026-09-20' }),
      );

      await recordAction(createPuzzle(), createSubmission(), 'check', false);

      expect(crosswordUserStatsDao.update).toHaveBeenCalledWith(
        expect.objectContaining({ currentStreak: 1, longestStreak: 9 }),
      );
    });

    it('only moves the streak once a day, however many actions follow', async () => {
      (crosswordUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(
        createStats({ currentStreak: 2, longestStreak: 2, lastPlayedDate: DATE, totalPlayed: 2 }),
      );

      await recordAction(createPuzzle(), createSubmission({ attempts: 1 }), 'check', false);

      expect(crosswordUserStatsDao.update).toHaveBeenCalledWith(
        expect.objectContaining({ currentStreak: 2, totalPlayed: 2 }),
      );
    });

    // The ManaMatrix rule: the archive is playable, but it can't build a streak.
    it('leaves the streak alone on an archive puzzle', async () => {
      (crosswordUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(
        createStats({ currentStreak: 5, longestStreak: 5, lastPlayedDate: YESTERDAY }),
      );

      await recordAction(
        createPuzzle({ isActive: false, date: '2026-09-01', id: '2026-09-01' }),
        createSubmission({ date: '2026-09-01' }),
        'submit',
        true,
      );

      expect(crosswordUserStatsDao.update).toHaveBeenCalledWith(
        expect.objectContaining({ currentStreak: 5, lastPlayedDate: YESTERDAY, totalSolved: 1 }),
      );
    });
  });

  describe('totals', () => {
    it('counts an unaided solve as a perfect day', async () => {
      await recordAction(createPuzzle(), createSubmission(), 'submit', true);

      expect(crosswordUserStatsDao.createUserStats).toHaveBeenCalledWith(
        expect.objectContaining({ totalSolved: 1, perfectDays: 1, bestTimeMs: 125_000 }),
      );
    });

    it('does not count a solve that used a check or a reveal', async () => {
      await recordAction(createPuzzle(), createSubmission({ checks: 1, attempts: 1 }), 'submit', true);

      expect(crosswordUserStatsDao.createUserStats).toHaveBeenCalledWith(
        expect.objectContaining({ totalSolved: 1, perfectDays: 0 }),
      );
    });

    it('keeps the best time when the new one is slower', async () => {
      (crosswordUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(createStats({ bestTimeMs: 30_000 }));

      await recordAction(createPuzzle(), createSubmission(), 'submit', true);

      expect(crosswordUserStatsDao.update).toHaveBeenCalledWith(expect.objectContaining({ bestTimeMs: 30_000 }));
    });

    it('takes the best time when the new one is faster', async () => {
      (crosswordUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(createStats({ bestTimeMs: 300_000 }));

      await recordAction(createPuzzle(), createSubmission(), 'submit', true);

      expect(crosswordUserStatsDao.update).toHaveBeenCalledWith(expect.objectContaining({ bestTimeMs: 125_000 }));
    });

    it('counts a day played once, on the first action', async () => {
      (crosswordUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(createStats({ totalPlayed: 4 }));

      await recordAction(createPuzzle(), createSubmission({ reveals: 2 }), 'check', false);

      expect(crosswordUserStatsDao.update).toHaveBeenCalledWith(expect.objectContaining({ totalPlayed: 4 }));
    });
  });
});
