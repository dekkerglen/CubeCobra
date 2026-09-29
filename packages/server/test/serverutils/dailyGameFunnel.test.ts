import { CrosswordSubmission } from '@utils/datatypes/Crossword';
import { ManaMatrixSubmission } from '@utils/datatypes/ManaMatrix';
import { SynergyConnectSubmission } from '@utils/datatypes/SynergyConnect';

import {
  classifyCrossword,
  classifyManaMatrix,
  classifySynergyConnect,
  datesBetween,
  dedupeByPlayer,
  emptyDay,
  isCrosswordEngaged,
  isSynergyExhausted,
  median,
  summarizeCrosswordDay,
  summarizeDailyP1P1Day,
  summarizeManaMatrixDay,
  summarizeSynergyConnectDay,
} from '../../src/serverutils/dailyGameFunnel';

const DATE = '2026-09-28';

const grid = (correctCells: number): boolean[][] => {
  const flat = Array.from({ length: 9 }, (_, i) => i < correctCells);
  return [flat.slice(0, 3), flat.slice(3, 6), flat.slice(6, 9)];
};

const manaMatrix = (overrides: Partial<ManaMatrixSubmission> = {}): ManaMatrixSubmission => ({
  userId: 'user-1',
  date: DATE,
  answers: [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ],
  correct: grid(0),
  attempts: 1,
  countedCells: {},
  dateCreated: 1,
  dateLastUpdated: 1,
  ...overrides,
});

const crossword = (overrides: Partial<CrosswordSubmission> = {}): CrosswordSubmission => ({
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

const synergy = (overrides: Partial<SynergyConnectSubmission> = {}): SynergyConnectSubmission => ({
  userId: 'user-1',
  date: DATE,
  solvedGroups: [],
  guesses: [],
  mistakes: 0,
  dateCreated: 1,
  dateLastUpdated: 1,
  ...overrides,
});

describe('ManaMatrix classification', () => {
  it('counts nine correct cells as finished', () => {
    expect(classifyManaMatrix(manaMatrix({ correct: grid(9) }))).toBe('finished');
  });

  it('counts eight correct cells as partial', () => {
    expect(classifyManaMatrix(manaMatrix({ correct: grid(8) }))).toBe('partial');
  });

  it('counts an attempt with nothing right as partial', () => {
    expect(classifyManaMatrix(manaMatrix({ correct: grid(0), attempts: 1 }))).toBe('partial');
  });

  it('trusts completedAt even if the grid disagrees', () => {
    expect(classifyManaMatrix(manaMatrix({ correct: grid(3), completedAt: 5000 }))).toBe('finished');
  });

  it('tolerates a missing or ragged correct grid', () => {
    expect(classifyManaMatrix(manaMatrix({ correct: undefined as unknown as boolean[][] }))).toBe('partial');
    expect(classifyManaMatrix(manaMatrix({ correct: [[true, true, true]] }))).toBe('partial');
  });
});

describe('Crossword classification', () => {
  it('counts solved as finished', () => {
    expect(classifyCrossword(crossword({ solved: true }))).toBe('finished');
  });

  it('counts an opened-but-unsolved session as partial', () => {
    expect(classifyCrossword(crossword())).toBe('partial');
  });

  it('separates opening the puzzle from touching it', () => {
    expect(isCrosswordEngaged(crossword())).toBe(false);
    expect(isCrosswordEngaged(crossword({ attempts: 1 }))).toBe(true);
    expect(isCrosswordEngaged(crossword({ checks: 1 }))).toBe(true);
    expect(isCrosswordEngaged(crossword({ reveals: 1 }))).toBe(true);
  });
});

describe('Synergy Connect classification', () => {
  it('counts four solved groups as finished', () => {
    expect(classifySynergyConnect(synergy({ solvedGroups: [0, 1, 2, 3] }))).toBe('finished');
  });

  it('counts three solved groups as partial', () => {
    expect(classifySynergyConnect(synergy({ solvedGroups: [0, 1, 2] }))).toBe('partial');
  });

  it('counts a player out of mistakes as partial, and flags them locked out', () => {
    const lockedOut = synergy({ solvedGroups: [0], mistakes: 4 });
    expect(classifySynergyConnect(lockedOut)).toBe('partial');
    expect(isSynergyExhausted(lockedOut)).toBe(true);
  });

  it('does not flag a winner who made four mistakes on the way', () => {
    // The guess route ends the game at four mistakes, so this should not arise; assert the
    // classifier's precedence anyway, because "solved" must always beat "locked out".
    const winner = synergy({ solvedGroups: [0, 1, 2, 3], mistakes: 4 });
    expect(classifySynergyConnect(winner)).toBe('finished');
    expect(isSynergyExhausted(winner)).toBe(false);
  });

  it('does not flag a player who is merely behind', () => {
    expect(isSynergyExhausted(synergy({ solvedGroups: [0], mistakes: 3 }))).toBe(false);
  });
});

describe('dedupeByPlayer', () => {
  it('counts one player with many attempts once', () => {
    // The real shape: the DAO increments attempts in place, so twenty tries is one row.
    const day = summarizeManaMatrixDay(DATE, [manaMatrix({ userId: 'u1', attempts: 20, correct: grid(4) })]);
    expect(day.started).toBe(1);
    expect(day.partial).toBe(1);
    expect(day.finished).toBe(0);
  });

  it('collapses duplicate rows for the same player into one', () => {
    const day = summarizeManaMatrixDay(DATE, [
      manaMatrix({ userId: 'u1', attempts: 1, correct: grid(2), dateLastUpdated: 10 }),
      manaMatrix({ userId: 'u1', attempts: 2, correct: grid(5), dateLastUpdated: 20 }),
      manaMatrix({ userId: 'u1', attempts: 3, correct: grid(7), dateLastUpdated: 30 }),
    ]);
    expect(day.started).toBe(1);
    expect(day.finished).toBe(0);
  });

  it('keeps the finished row when a player appears both finished and partial', () => {
    const day = summarizeManaMatrixDay(DATE, [
      manaMatrix({ userId: 'u1', correct: grid(9), dateLastUpdated: 10 }),
      manaMatrix({ userId: 'u1', correct: grid(4), dateLastUpdated: 99 }),
    ]);
    expect(day.started).toBe(1);
    expect(day.finished).toBe(1);
    expect(day.partial).toBe(0);
  });

  it('keeps distinct players distinct', () => {
    const day = summarizeManaMatrixDay(DATE, [
      manaMatrix({ userId: 'u1', correct: grid(9) }),
      manaMatrix({ userId: 'u2', correct: grid(1) }),
      manaMatrix({ userId: 'u3', correct: grid(9) }),
    ]);
    expect(day.started).toBe(3);
    expect(day.finished).toBe(2);
    expect(day.partial).toBe(1);
    expect(day.completionRate).toBeCloseTo(2 / 3);
  });

  it('prefers the more recently updated of two equally-progressed rows', () => {
    const [kept] = dedupeByPlayer(
      [
        manaMatrix({ userId: 'u1', attempts: 1, dateLastUpdated: 10 }),
        manaMatrix({ userId: 'u1', attempts: 9, dateLastUpdated: 20 }),
      ],
      classifyManaMatrix,
    );
    expect(kept!.attempts).toBe(9);
  });
});

describe('empty days', () => {
  it('reports zeros and no rate for a day nobody played', () => {
    for (const day of [
      summarizeManaMatrixDay(DATE, []),
      summarizeSynergyConnectDay(DATE, []),
      summarizeCrosswordDay(DATE, []),
      summarizeDailyP1P1Day(DATE, []),
    ]) {
      expect(day.date).toBe(DATE);
      expect(day.started).toBe(0);
      expect(day.partial).toBe(0);
      expect(day.finished).toBe(0);
      // null rather than 0: nobody failed to finish, there was nobody.
      expect(day.completionRate).toBeNull();
    }
  });

  it('reports no median solve time for a day nobody solved', () => {
    expect(summarizeCrosswordDay(DATE, []).medianCompletionTimeMs).toBeNull();
    expect(summarizeCrosswordDay(DATE, [crossword({ solved: false })]).medianCompletionTimeMs).toBeNull();
  });

  it('builds a zero-filled placeholder day', () => {
    expect(emptyDay(DATE)).toEqual({ date: DATE, started: 0, partial: 0, finished: 0, completionRate: null });
    expect(emptyDay(DATE, { exhausted: 0 }).exhausted).toBe(0);
  });
});

describe('summarizeCrosswordDay', () => {
  it('splits openers from players and medians only the solvers', () => {
    const day = summarizeCrosswordDay(DATE, [
      // Opened, never touched it.
      crossword({ userId: 'u1' }),
      // Played, gave up.
      crossword({ userId: 'u2', attempts: 4, checks: 2 }),
      // Solved.
      crossword({ userId: 'u3', attempts: 6, solved: true, completionTimeMs: 100_000 }),
      crossword({ userId: 'u4', attempts: 3, solved: true, completionTimeMs: 300_000 }),
      crossword({ userId: 'u5', attempts: 1, solved: true, completionTimeMs: 200_000 }),
    ]);

    expect(day.started).toBe(5);
    expect(day.engaged).toBe(4);
    expect(day.finished).toBe(3);
    expect(day.partial).toBe(2);
    expect(day.completionRate).toBeCloseTo(3 / 5);
    expect(day.medianCompletionTimeMs).toBe(200_000);
  });

  it('ignores a completionTimeMs on an unsolved row', () => {
    const day = summarizeCrosswordDay(DATE, [
      crossword({ userId: 'u1', solved: false, completionTimeMs: 9_999 }),
      crossword({ userId: 'u2', solved: true, completionTimeMs: 50_000 }),
    ]);
    expect(day.medianCompletionTimeMs).toBe(50_000);
  });
});

describe('summarizeSynergyConnectDay', () => {
  it('breaks locked-out players out of partial without double counting', () => {
    const day = summarizeSynergyConnectDay(DATE, [
      synergy({ userId: 'u1', solvedGroups: [0, 1, 2, 3], completedAt: 5 }),
      synergy({ userId: 'u2', solvedGroups: [0], mistakes: 4 }),
      synergy({ userId: 'u3', solvedGroups: [], mistakes: 4 }),
      synergy({ userId: 'u4', solvedGroups: [0, 1], mistakes: 1 }),
    ]);

    expect(day.started).toBe(4);
    expect(day.finished).toBe(1);
    expect(day.partial).toBe(3);
    expect(day.exhausted).toBe(2);
    // Locked-out players are inside partial, so the stack must not exceed the total.
    expect(day.finished + day.partial).toBe(day.started);
  });
});

describe('summarizeDailyP1P1Day', () => {
  it('counts distinct voters with no funnel', () => {
    const day = summarizeDailyP1P1Day(DATE, ['u1', 'u2', 'u3']);
    expect(day.started).toBe(3);
    expect(day.finished).toBe(3);
    expect(day.partial).toBe(0);
    expect(day.completionRate).toBe(1);
  });

  it('counts a repeated voter once', () => {
    expect(summarizeDailyP1P1Day(DATE, ['u1', 'u1', 'u2']).started).toBe(2);
  });
});

describe('median', () => {
  it('averages the two middle values for an even sample', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('takes the middle value for an odd sample', () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it('is undefined for an empty sample', () => {
    expect(median([])).toBeUndefined();
  });

  it('does not mutate its input', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('datesBetween', () => {
  it('is inclusive of both ends', () => {
    expect(datesBetween('2026-09-26', '2026-09-28')).toEqual(['2026-09-26', '2026-09-27', '2026-09-28']);
  });

  it('returns a single day for an equal range', () => {
    expect(datesBetween(DATE, DATE)).toEqual([DATE]);
  });

  it('returns nothing when the end precedes the start', () => {
    expect(datesBetween('2026-09-28', '2026-09-26')).toEqual([]);
  });

  it('crosses a month boundary', () => {
    expect(datesBetween('2026-09-30', '2026-10-02')).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('crosses a leap day', () => {
    expect(datesBetween('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });

  it('returns nothing for an unparseable date', () => {
    expect(datesBetween('not-a-date', DATE)).toEqual([]);
  });
});
