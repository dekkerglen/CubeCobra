import { CrosswordPuzzle, CrosswordSubmission } from '@utils/datatypes/Crossword';

jest.mock('../../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../../src/dynamo/daos'),
  crosswordPuzzleDao: { getByDate: jest.fn(), getActive: jest.fn() },
  crosswordSubmissionDao: { getByUserAndDate: jest.fn(), createSubmission: jest.fn(), update: jest.fn() },
  crosswordUserStatsDao: { getByUserId: jest.fn(), createUserStats: jest.fn(), update: jest.fn() },
}));

import { crosswordPuzzleDao, crosswordSubmissionDao, crosswordUserStatsDao } from '../../../src/dynamo/daos';
import { getActiveCrosswordHandler } from '../../../src/router/routes/tool/api/crossword/active';
import { checkCrosswordHandler } from '../../../src/router/routes/tool/api/crossword/check';
import { revealCrosswordHandler } from '../../../src/router/routes/tool/api/crossword/reveal';
import { submitCrosswordHandler } from '../../../src/router/routes/tool/api/crossword/submit';
import { createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

const DATE = '2026-09-28';
const NOW = 1_800_000_000_000;

const SOLUTION = [
  ['C', 'A', 'T'],
  ['A', 'R', 'E'],
  ['T', 'E', 'N'],
];

const BLANK = [
  ['', '', ''],
  ['', '', ''],
  ['', '', ''],
];

const createPuzzle = (overrides?: Partial<CrosswordPuzzle>): CrosswordPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  grid: {
    width: 3,
    height: 3,
    blockCount: 0,
    blocks: [
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ],
    letters: SOLUTION.map((row) => [...row]),
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
      {
        id: 'd-0-2',
        direction: 'down',
        row: 0,
        col: 2,
        length: 3,
        number: 3,
        entry: { text: 'TEN', display: 'A round number', entryClass: 'nameWord' },
        clue: 'Fingers, all told',
      },
    ],
  },
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

const createSubmission = (overrides?: Partial<CrosswordSubmission>): CrosswordSubmission => ({
  userId: 'user-1',
  date: DATE,
  startedAt: NOW - 90_000,
  attempts: 0,
  checks: 0,
  reveals: 0,
  solved: false,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

const user = () => createUser({ id: 'user-1' });

describe('crossword play API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(createPuzzle());
    (crosswordPuzzleDao.getActive as jest.Mock).mockResolvedValue(createPuzzle());
    (crosswordSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(createSubmission());
    (crosswordUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(undefined);
    (crosswordSubmissionDao.createSubmission as jest.Mock).mockImplementation(async (doc) => ({
      ...doc,
      dateCreated: NOW,
      dateLastUpdated: NOW,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('active', () => {
    it('serves a board with no answers in it', async () => {
      const res = await call(getActiveCrosswordHandler).send();

      expect(res.status).toEqual(200);
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('CAT');
      expect(serialized).not.toContain('Felidae');
      expect(res.body.board.slots[0]!.clue).toEqual('Purring pet');
      expect(res.body.answers).toBeNull();
    });

    it('starts the clock for a logged-in viewer and reports the elapsed time', async () => {
      const res = await call(getActiveCrosswordHandler).as(user()).send();

      expect(res.status).toEqual(200);
      expect(res.body.elapsedMs).toEqual(90_000);
      expect(res.body.submission.startedAt).toEqual(NOW - 90_000);
    });

    it('has no clock for an anonymous viewer', async () => {
      const res = await call(getActiveCrosswordHandler).send();

      expect(res.body.submission).toBeNull();
      expect(res.body.elapsedMs).toBeNull();
      expect(crosswordSubmissionDao.createSubmission).not.toHaveBeenCalled();
    });

    it('returns 404 when there is no puzzle yet', async () => {
      (crosswordPuzzleDao.getActive as jest.Mock).mockResolvedValue(undefined);

      const res = await call(getActiveCrosswordHandler).send();

      expect(res.status).toEqual(404);
    });

    it('includes the answers once this viewer has solved it', async () => {
      (crosswordSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(
        createSubmission({ solved: true, completionTimeMs: 90_000 }),
      );

      const res = await call(getActiveCrosswordHandler).as(user()).send();

      expect(res.body.answers).toHaveLength(2);
      expect(res.body.answers[0]!.text).toEqual('CAT');
    });
  });

  describe('check', () => {
    it('returns 404 for a date with no puzzle', async () => {
      (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);

      const res = await call(checkCrosswordHandler).withBody({ date: DATE, letters: BLANK }).send();

      expect(res.status).toEqual(404);
    });

    it('names the wrong cells without saying what belongs in them', async () => {
      const guess = [
        ['C', 'A', 'T'],
        ['A', 'X', 'E'],
        ['T', 'E', 'N'],
      ];

      const res = await call(checkCrosswordHandler).as(user()).withBody({ date: DATE, letters: guess }).send();

      expect(res.status).toEqual(200);
      expect(res.body.wrong).toEqual(['1,1']);
      expect(res.body.blank).toEqual(0);
      expect(res.body.solved).toBe(false);
      expect(res.body.answers).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain('Felidae');
    });

    it('charges the check and records the solve when the grid is right', async () => {
      const res = await call(checkCrosswordHandler).as(user()).withBody({ date: DATE, letters: SOLUTION }).send();

      expect(res.status).toEqual(200);
      expect(res.body.solved).toBe(true);
      expect(res.body.submission).toMatchObject({ solved: true, checks: 1, attempts: 1, completionTimeMs: 90_000 });
      // Solved, so the answers are no longer a secret.
      expect(res.body.answers).toHaveLength(2);
      expect(crosswordUserStatsDao.createUserStats).toHaveBeenCalledWith(
        expect.objectContaining({ totalSolved: 1, currentStreak: 1 }),
      );
    });

    it('grades an anonymous check but persists nothing', async () => {
      const res = await call(checkCrosswordHandler).withBody({ date: DATE, letters: SOLUTION }).send();

      expect(res.status).toEqual(200);
      expect(res.body.solved).toBe(true);
      expect(res.body.submission).toBeNull();
      expect(res.body.stats).toBeNull();
      expect(crosswordSubmissionDao.update).not.toHaveBeenCalled();
      expect(crosswordSubmissionDao.createSubmission).not.toHaveBeenCalled();
      expect(crosswordUserStatsDao.createUserStats).not.toHaveBeenCalled();
    });

    it('returns 500 when the lookup fails', async () => {
      (crosswordPuzzleDao.getByDate as jest.Mock).mockRejectedValue(new Error('dynamo down'));

      const res = await call(checkCrosswordHandler).withBody({ date: DATE, letters: BLANK }).send();

      expect(res.status).toEqual(500);
    });
  });

  describe('submit', () => {
    it('says no without saying which letters are wrong', async () => {
      const guess = [
        ['C', 'A', 'T'],
        ['A', 'X', 'E'],
        ['T', 'E', 'N'],
      ];

      const res = await call(submitCrosswordHandler).as(user()).withBody({ date: DATE, letters: guess }).send();

      expect(res.status).toEqual(200);
      expect(res.body.solved).toBe(false);
      expect(res.body).not.toHaveProperty('wrong');
      expect(res.body.answers).toBeNull();
    });

    it('records the solve without spending a check', async () => {
      const res = await call(submitCrosswordHandler).as(user()).withBody({ date: DATE, letters: SOLUTION }).send();

      expect(res.status).toEqual(200);
      expect(res.body.submission).toMatchObject({ solved: true, checks: 0, attempts: 1, completionTimeMs: 90_000 });
    });

    it('judges an anonymous submit but persists nothing', async () => {
      const res = await call(submitCrosswordHandler).withBody({ date: DATE, letters: SOLUTION }).send();

      expect(res.body.solved).toBe(true);
      expect(res.body.submission).toBeNull();
      expect(crosswordSubmissionDao.update).not.toHaveBeenCalled();
    });
  });

  describe('reveal', () => {
    it('gives one word and charges a reveal', async () => {
      const res = await call(revealCrosswordHandler).as(user()).withBody({ date: DATE, slotId: 'd-0-2' }).send();

      expect(res.status).toEqual(200);
      expect(res.body.revealed.cells).toEqual([
        { row: 0, col: 2, letter: 'T' },
        { row: 1, col: 2, letter: 'E' },
        { row: 2, col: 2, letter: 'N' },
      ]);
      expect(res.body.submission).toMatchObject({ reveals: 1, attempts: 0 });
    });

    // Slot ids are public, so an anonymous reveal would be a way to read the
    // whole grid one word at a time with nothing to charge it to.
    it('refuses an anonymous request', async () => {
      const res = await call(revealCrosswordHandler).withBody({ date: DATE, slotId: 'd-0-2' }).send();

      expect(res.status).toEqual(401);
      expect(crosswordSubmissionDao.update).not.toHaveBeenCalled();
    });

    it('rejects a slot id that is not in the puzzle', async () => {
      const res = await call(revealCrosswordHandler).as(user()).withBody({ date: DATE, slotId: 'made-up' }).send();

      expect(res.status).toEqual(400);
      expect(crosswordSubmissionDao.update).not.toHaveBeenCalled();
    });

    it('returns 404 for a date with no puzzle', async () => {
      (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);

      const res = await call(revealCrosswordHandler).as(user()).withBody({ date: DATE, slotId: 'd-0-2' }).send();

      expect(res.status).toEqual(404);
    });
  });
});
