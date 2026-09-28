/**
 * What `generateCrossword` is allowed to spend, and who decides.
 *
 * The budget used to be a module constant shared by every caller, and the reason
 * it isn't any more is the daily path: `buildDailyGrid` is reached from the
 * rotate endpoint with the daily jobs lambda blocked on the response, so a
 * budget sized for a human watching a lab fill a grid is, over there, a lambda
 * timeout and a day with no puzzle. These tests pin the two ends of that: the
 * default is seconds, and the daily path takes it.
 *
 * The solver and the vocabulary are both mocked out. Neither is under test here
 * — what is under test is the attempt loop's clock — and mocking them is what
 * lets the clock be a fake one, so a twenty-second budget is asserted in
 * milliseconds.
 */

jest.mock('serverutils/crossword/vocabulary', () => ({
  // One object for every class set, so `generateCrossword` sees a single
  // vocabulary and skips the acronym fallback it would otherwise have.
  vocabularyForClasses: jest.fn(() => ({
    entries: [],
    // Deep enough at every length that the frame plan's supply check passes.
    byLength: new Map(Array.from({ length: 22 }, (_, length) => [length, Array.from({ length: 100 }, (__, i) => i)])),
    counts: {},
  })),
  themedCardTexts: jest.fn(() => new Set<string>()),
}));

jest.mock('serverutils/crossword/wfc', () => ({
  isWfcFailure: (result: any) => result?.reason !== undefined,
  // Seeding always succeeds, so every pass of the loop reaches the solver.
  findSeedEntries: jest.fn(() => []),
  runWfc: jest.fn(() => ({ reason: 'mocked: never fills', steps: 1 })),
  // The real one, not a stub. The attempt loop yields through this whenever
  // somebody is watching, and the clock these tests fake is `Date.now` rather
  // than the timers — so a genuine setImmediate resolves normally here and the
  // loop's accounting is measured against the thing that actually runs.
  yieldToEventLoop: () => new Promise<void>((resolve) => setImmediate(resolve)),
}));

import { ALL_CROSSWORD_CLASSES, CrosswordGenerationOptions } from '@utils/datatypes/Crossword';
import { generateCrossword } from 'serverutils/crossword/generate';
import { runWfc } from 'serverutils/crossword/wfc';

/** Wall-clock each mocked attempt is made to consume. */
const ATTEMPT_MS = 1_000;

const options = (): CrosswordGenerationOptions => ({
  size: 9,
  symmetry: 'rotational180',
  minWordLength: 3,
  maxAcronymRatio: 0.1,
  themeFilterText: '',
  allowedClasses: [...ALL_CROSSWORD_CLASSES],
  preferredClasses: [...ALL_CROSSWORD_CLASSES],
  seed: 'budget-test',
});

describe('generateCrossword budget', () => {
  let clock = 1_700_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    clock = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
    // Time only moves when an attempt runs, so "how long did it spend" and "how
    // many attempts did it get" are the same question, exactly.
    (runWfc as jest.Mock).mockImplementation(() => {
      clock += ATTEMPT_MS;
      return { reason: 'mocked: never fills', steps: 1 };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('spends twenty seconds when the caller does not say otherwise', async () => {
    await generateCrossword(options());

    // 20s of attempts at a second each. This is the number the daily jobs lambda
    // is sized around; moving it means re-checking that timeout.
    expect((runWfc as jest.Mock).mock.calls.length).toBe(20_000 / ATTEMPT_MS);
  });

  it('spends what the caller asks for instead, when it asks', async () => {
    await generateCrossword(options(), { budgetMs: 180_000 });

    expect((runWfc as jest.Mock).mock.calls.length).toBe(180_000 / ATTEMPT_MS);
  });

  it('keeps the per-attempt slice short whatever the total is', async () => {
    const slices: number[] = [];
    (runWfc as jest.Mock).mockImplementation((params: any) => {
      slices.push(params.deadline - clock);
      clock += ATTEMPT_MS;
      return { reason: 'mocked: never fills', steps: 1 };
    });

    await generateCrossword(options(), { budgetMs: 180_000 });

    // A long total budget buys more re-seeds, not a longer grind on one seeding —
    // see ATTEMPT_BUDGET_MS. Every attempt is still cut off within a second of
    // starting, so a stuck collapse cannot eat the whole three minutes.
    expect(slices).not.toHaveLength(0);
    expect(Math.max(...slices)).toBeLessThanOrEqual(1_000);
  });
});

describe('generateCrossword progress', () => {
  let clock = 1_700_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    clock = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes no callback through when nobody is listening, so the solver skips its gate', async () => {
    (runWfc as jest.Mock).mockImplementation(() => {
      clock += ATTEMPT_MS;
      return { reason: 'mocked: never fills', steps: 1 };
    });

    await generateCrossword(options());

    expect((runWfc as jest.Mock).mock.calls[0]![0].onProgress).toBeUndefined();
  });

  it('stamps each snapshot with the attempt it came from and the time it arrived', async () => {
    const seen: { attempt: number; elapsedMs: number; steps: number; size: number; restarts: number }[] = [];

    (runWfc as jest.Mock).mockImplementation((params: any) => {
      clock += ATTEMPT_MS;
      // Two snapshots per attempt, as a real collapse would emit.
      params.onProgress({ cells: [1, 0, -1], steps: 4, restarts: 0 });
      params.onProgress({ cells: [0, 0, -1], steps: 8, restarts: 1 });
      return { reason: 'mocked: never fills', steps: 8 };
    });

    await generateCrossword(options(), { budgetMs: 3_000, onProgress: (progress) => seen.push(progress) });

    expect(seen).toHaveLength(6);
    // 1-based and monotone: the view resets when this moves, so a viewer needs to
    // be able to tell "the grid restarted" from "the grid is being rebuilt".
    expect(seen.map((s) => s.attempt)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(seen.map((s) => s.elapsedMs)).toEqual([1_000, 1_000, 2_000, 2_000, 3_000, 3_000]);
    expect(seen.map((s) => s.steps)).toEqual([4, 8, 4, 8, 4, 8]);
    // The solver's own restart counter survives the wrapping. The grid jumps
    // backwards when it moves too, just less far than an attempt boundary.
    expect(seen.map((s) => s.restarts)).toEqual([0, 1, 0, 1, 0, 1]);
    // The grid side travels with the snapshot, so `cells` reads as a square
    // without the consumer having to remember what it asked for.
    expect(new Set(seen.map((s) => s.size))).toEqual(new Set([9]));
  });
});
