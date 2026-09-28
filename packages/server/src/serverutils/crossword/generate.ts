import { CrosswordGenerationOptions, CrosswordPuzzleGrid } from '@utils/datatypes/Crossword';
import seedrandom from 'seedrandom';

import { themedCardTexts, Vocabulary, vocabularyForClasses } from './vocabulary';
import { findSeedEntries, isWfcFailure, runWfc, SeedPlan, SeedSlot, WfcProgress, yieldToEventLoop } from './wfc';

export interface GenerateResult {
  grid: CrosswordPuzzleGrid;
  /** Black squares the generator had to introduce. */
  blocksAdded: number;
  /** Collapse steps across every attempt, not just the one that worked. */
  fillSteps: number;
  acronymsUsed: number;
  themeSize: number;
  durationMs: number;
}

export interface GenerateFailure {
  reason: string;
  blocksAdded: number;
}

/**
 * One mid-generation look at the grid, for a caller that wants to watch.
 *
 * `cells` and `steps` are the collapse's own (see WfcProgress); `attempt` and
 * `elapsedMs` are this loop's. Both counters matter to a viewer: the grid resets
 * when `attempt` moves — a fresh seeding, so a different shape — and again, less
 * dramatically, when `restarts` moves inside one attempt. Without them a viewer
 * sees a half-built grid vanish and has no way to tell progress from a bug.
 */
export interface CrosswordProgress extends WfcProgress {
  /** Grid side, so `cells` can be read as a square without further context. */
  size: number;
  /** 1-based, counting only attempts that got as far as a collapse. */
  attempt: number;
  elapsedMs: number;
}

export interface GenerateControls {
  /**
   * Overrides DEFAULT_TOTAL_BUDGET_MS. Only for callers with nobody waiting on a
   * timer: without `onProgress` generation is a straight blocking loop, so
   * whatever is passed here is also how long this process stops serving anything
   * else. With `onProgress` it yields between snapshots and the block is broken
   * up, but the wall clock is the same.
   */
  budgetMs?: number;
  /**
   * Called periodically during every attempt's collapse.
   *
   * Passing this also changes *how* generation runs: it makes the loop yield to
   * the event loop on the same cadence, because a snapshot that is only written
   * is a snapshot nobody receives until the whole call returns. See
   * `yieldToEventLoop` in wfc.ts for the mechanism and the measurement. Callers
   * with no viewer leave it off and pay nothing.
   */
  onProgress?: (progress: CrosswordProgress) => void;
}

/**
 * How long a request may spend generating, when the caller doesn't say.
 *
 * This is the number the daily path runs on and it is sized by who is waiting:
 * `buildDailyGrid` is reached from the rotate endpoint with the daily jobs lambda
 * blocked on the HTTP response, so a budget that overruns the lambda's timeout is
 * a day with no puzzle. Twenty seconds leaves room for SEED_ATTEMPTS of them.
 *
 * A caller with nobody on a timer — the admin lab — passes `budgetMs` instead.
 * See `generateCrossword`.
 */
const DEFAULT_TOTAL_BUDGET_MS = 20_000;
/**
 * One attempt is a fresh collapse from a fresh set of theme entries, and the
 * slice is deliberately short. Measured over the benchmark sizes, an attempt
 * that is going to work finds its grid in a few hundred milliseconds and one
 * that isn't grinds until it is cut off — giving a stuck attempt ten times the
 * budget doesn't rescue it, because what decides whether a grid exists is which
 * theme entries got seeded. So the budget buys re-seeds, not persistence.
 *
 * That holds for hard grids too, which is where it might have been expected to
 * break: an 11x11 seeded with a fifth long entry fills 1 attempt in 6 at 800ms and
 * the same 1 in 6 at 3000ms.
 */
const ATTEMPT_BUDGET_MS = 800;
const MAX_STEPS = 60_000;

/**
 * Consecutive seeding misses that count as proof this vocabulary cannot frame
 * this grid.
 *
 * The frame search is bounded (see FRAME_TRIES in wfc.ts), so one miss proves
 * nothing — but every attempt redraws from the same pool of full-length entries,
 * so dozens in a row means there is no corner-consistent frame to find. Without
 * a cutoff the remaining budget goes on rediscovering that a few hundred thousand
 * times over, since a miss costs microseconds; there used to be an unseedable-
 * proof rung at the bottom of the ladder to fall into, and there isn't any more.
 */
const SEEDING_MISSES_BEFORE_GIVING_UP = 64;

/**
 * Full-length entries — `slot.length === size`, edge to edge — that a delivered
 * grid has to carry in each direction, so four in total.
 *
 * Long slots are the only ones deep enough to hold a card name, so they are what
 * carries the theme; a grid with one of them is a word square with a themed
 * answer bolted on. Four, crossing, is the least that reads as a themed puzzle.
 *
 * This is a floor rather than a preference. A grid that comes out of the search
 * with fewer is discarded and the seeding tried again, and when the clock runs
 * out the request fails instead of returning a thinner grid — the ladder used to
 * degrade quietly to two long entries, and quiet degradation is what this
 * replaces. See `framePlan` for why nothing below the frame is worth trying.
 */
const MIN_FULL_LENGTH_PER_DIRECTION = 2;

/**
 * Length a delivered grid's entries have to average, enforced as a ceiling on how
 * many of them there may be.
 *
 * Runs shorter than `minWordLength` don't exist (see `allRunsValid`), so every white
 * cell belongs to exactly one across entry and one down entry, the entry lengths sum
 * to twice the white count, and
 *
 *     mean entry length = 2 * (white cells) / (number of entries)
 *
 * identically. Length is therefore a property of how many *runs* the black squares
 * cut the grid into, and of nothing else — not of the block count, and not of how
 * much white there is, except through that quotient.
 *
 * This is a floor that the generator clears comfortably, and deliberately so: it is
 * a tripwire, not the lever. Driving entry length from here was tried and it does not
 * work. Asked for a mean of 4.5, the collapse returns a qualifying grid 1 time in 6
 * at 9x9, 5 in 6 at 11x11, 2 in 6 at 13x13 and 1 in 6 at 14x14, taking 10 to 19
 * seconds when it manages at all — and that is with the ceiling enforced inside the
 * collapse as a sound lower bound on the finished run count, so that a doomed layout
 * is abandoned during shaping rather than after a full fill. The reason it fails is
 * visible in the grids that do qualify: forbidding a run forbids most of the black
 * squares that would have created one, and what is left is too open for this
 * vocabulary to interlock. The single 9x9 that qualified had 12 black squares against
 * the usual 18.
 *
 * Seeding long entries before the collapse is what actually removes runs; see
 * INTERIOR_SEED_LINES. This is here to make sure a fill that stopped delivering them
 * fails the request instead of quietly shipping a grid of three-letter entries, which
 * is the observed failure mode of every soft attempt at the same goal — a per-run
 * length reward in `runValue` took 11x11 to 75.6% three-letter entries, a mean of
 * about 3.4. The lowest mean measured over 12 grids at each of 9, 11, 13 and 14 is
 * 3.83, so the floor sits below that and above the regression it is there to catch.
 *
 * 3-letter entries stay legal and stay common, which is deliberate: set codes are
 * three letters. This caps their share, not their existence.
 */
const TARGET_MEAN_ENTRY_LENGTH = 3.7;

/** The entry ceiling TARGET_MEAN_ENTRY_LENGTH works out to for a given grid. */
const maxEntriesFor = (whiteCells: number): number => Math.floor((2 * whiteCells) / TARGET_MEAN_ENTRY_LENGTH);

/**
 * Long entries seeded on lines *between* the two frame lines, in each direction.
 *
 * This is the lever on entry length, and the only one that has worked. A seeded line
 * holds exactly one entry by construction, so each interior line turns two lines —
 * one across, one down — that would have been cut into two or three runs apiece into
 * lines of one, and mean entry length is `2 * white / runs` identically. Committing
 * the entries while the grid is still empty makes that a fact the collapse works
 * around rather than a preference it can trade away. See `framePlan`.
 *
 * One, and only up to MAX_INTERIOR_SEED_SIZE. Two interior lines each way is eight
 * seeded entries and does not fill at any size (0 of 4 at 11x11; at 13x13 the frame
 * search cannot even find ten long entries that agree where they cross).
 *
 * What it buys is a *themed* grid. A themeless 9x9 was already averaging 4.32 letters
 * per entry with 43% of the grid three letters long, because a themeless frame draws
 * its four long entries from the whole vocabulary and lands somewhere the fill likes.
 * It is the theme filter that used to drag entry length down — a themed 9x9 averaged
 * 3.98 with 68% three-letter entries — and seeding an interior line is what gets those
 * grids back to where the themeless ones already were.
 */
const INTERIOR_SEED_LINES = 1;

/**
 * Largest grid that gets an interior seeded line.
 *
 * Measured, not derived, and the cliff is sharp. With one interior line each way at
 * `INTERIOR_SEED_INSET`, 9x9 fills 12 grids out of 12 — mean entry length 3.98 to
 * 4.31, three-letter entries 68% of the grid down to 42%, and faster than before, at
 * 392ms against 572ms. 11x11 fills 1 grid in 6 and 13x13 2 in 6, and nothing moved
 * that: inset 0 and 1 are worse, a fourth line each way is worse, seeding the interior
 * line in one direction only is worse, four times the per-attempt search budget
 * changes nothing, and the grids that do come out are no better than the ones the
 * plain frame produces. A fifth long entry is simply more than this vocabulary can
 * interlock at 11 letters and up.
 *
 * So it is a size cutoff and not a rule about shape, because one data point either
 * side of it is all the evidence there is. Worth re-measuring whenever the
 * vocabulary grows at lengths 7 and up — that is what would move it.
 */
const MAX_INTERIOR_SEED_SIZE = 9;

/**
 * Cells left black at each end of an interior seeded line.
 *
 * `minWordLength - 1` is both the largest value this may take and the only one that
 * works, which is not a coincidence.
 *
 * It is the largest because the frame's own lines sit at that offset, and an interior
 * line must not black out a cell one of them needs lettered.
 *
 * It is the only one that works because an interior line has to bring its own black
 * squares. A third seeded line in each direction at inset 1 filled 0 grids of 3 at
 * every one of 9x9, 11x11 and 13x13, and at inset 0 the same, the frame seeding fine
 * each time and the collapse then running the clock out — because a seeded line with
 * no boundary of its own drags every line crossing it open, which is the same effect
 * that keeps the frame off the outer edge. At `minWordLength - 1` the same plan fills,
 * and the black squares the interior lines carry sit hard against the edges, which is
 * where a black square costs the fewest runs.
 */
const INTERIOR_SEED_INSET = 2;

/**
 * Which lines get a long entry laid down before the collapse starts: two rows and two
 * columns at `minWordLength - 1` from each edge, always full-length, plus `interior`
 * evenly spaced lines of each between them. Null when the grid is too small to hold
 * two distinct frame lines (`far > near`), and then the request fails rather than
 * quietly dropping the requirement.
 *
 * Seeding is the strongest lever on entry length there is here, and this is why: a
 * seeded line is *one* run where that stretch would otherwise have become two or
 * three, and mean entry length is `2 * white / runs` and nothing else. The commitment
 * is made while the grid is still maximally open, so it is a fact the collapse works
 * around rather than a preference it can trade away — which is more than can be said
 * for the alternatives. A length reward per run made entries *shorter*; a lower block
 * density raised the entry count; requiring a mean length outright (see
 * TARGET_MEAN_ENTRY_LENGTH) cost most of the success rate.
 *
 * This used to be the top of a ladder that degraded — two rows, then a centre
 * cross, then one row, then no theme at all — and that is what has gone. A plan
 * seeding fewer long entries cannot make the difference up later: the fill
 * heuristic prices a long run far below the short ones it displaces (see
 * `runValue` in wfc.ts), so a full-length slot nobody asked for is essentially
 * never volunteered. Seeding two rows and hoping for two columns is not a weaker
 * version of this plan, it is a different answer to the question, so the whole
 * budget goes on re-drawing this one instead.
 *
 * The outer pair does not go on the outer edge, despite that being the obvious
 * place for a frame. A white row 0 means the top run of every column starts at row
 * 0, so rows 1 and 2 are white too — and by symmetry so are the bottom three rows
 * and the outer three columns. Black squares are then confined to the middle of
 * the grid and nearly every line becomes a full-length word: twelve of them in a
 * 9x9, which no Magic vocabulary can interlock (there are ~1500 nine-letter
 * entries where a crossword dictionary has six figures). The first offset that
 * doesn't drag its neighbours open with it is minWordLength - 1, so that is
 * where the frame sits: at that offset a column may still start its top run at
 * row 1 and finish at row 3, which is the freedom row 0 takes away.
 *
 * The interior lines are inset rather than full-length for the same reason turned
 * around: a line with no boundary of its own drags its crossings open, and where
 * the frame can afford that the interior cannot — a grid with three spanning lines
 * each way has no legal cut left in the outer rows and columns. Inset, each one
 * brings the black squares that end it along with it. See INTERIOR_SEED_INSET and
 * SeedSlot in wfc.ts.
 */
const framePlan = (size: number, minWordLength: number, interior: number, inset: number): SeedPlan | null => {
  const near = minWordLength - 1;
  const far = size - 1 - near;
  if (far <= near) {
    return null;
  }
  // An interior line blacks out `inset` cells at each end of itself, and those cells
  // must not be ones the crossing direction wants lettered. Every seeded line sits at
  // `near` or further in, and `near` is `minWordLength - 1`, so any inset up to that
  // is clear of all of them.
  const safeInset = Math.max(0, Math.min(inset, near));

  const lines: SeedSlot[] = [
    { at: near, inset: 0 },
    { at: far, inset: 0 },
  ];
  // Evenly spaced, which is what makes the set symmetric — `near + far` is `size - 1`,
  // so a run of equally spaced lines between them mirrors onto itself. The spacing has
  // to come out whole, and it has to leave a gap: two adjacent seeded lines are two
  // adjacent all-white lines, and then every line crossing them is dragged open for
  // the reason the frame sits off the edge at all. When the requested count can't be
  // placed the next count down is used instead — an even-sided grid has no centre
  // line, so one interior line there means none.
  for (let count = interior; count > 0; count--) {
    const span = far - near;
    if (span % (count + 1) !== 0 || span / (count + 1) < 2) {
      continue;
    }
    const step = span / (count + 1);
    for (let i = 1; i <= count; i++) {
      lines.push({ at: near + i * step, inset: safeInset });
    }
    break;
  }

  // The same lines each way. Seeding the interior line in only one direction was
  // measured and is not a halfway house — it fails to fill at 11x11 just as the
  // symmetric version does, for half the gain where it works.
  const label = lines.length === 2 ? 'a four-entry theme frame' : `a theme frame of ${2 * lines.length} long entries`;
  return { label, rows: lines, cols: lines.map((slot) => ({ ...slot })) };
};

/**
 * Builds a square crossword by collapsing a grid of cells whose domains span
 * {A..Z, black square}, so the block pattern comes out of the search instead of
 * being imposed on it. Long theme entries are laid down first, then the rest of
 * the grid is filled by propagation and backtracking search — see `wfc.ts`.
 *
 * The theme frame is not negotiable — MIN_FULL_LENGTH_PER_DIRECTION long entries
 * each way or nothing — so the budget buys repeated attempts at the same frame
 * rather than progressively weaker ones. Which theme entries land in the frame is
 * what decides whether a grid exists at all, so a fresh draw is worth far more
 * than a longer search; the only thing that does degrade is the vocabulary, which
 * opens up to acronyms for the tail of the clock.
 *
 * `controls` is a second argument rather than part of CrosswordGenerationOptions
 * because that type is the *puzzle's* description — it is what the lab's request
 * body validates against, what DAILY_CROSSWORD_OPTIONS spells out, and what a
 * seed has to reproduce. How long to spend, and who to tell about it on the way,
 * are properties of the call and not of the puzzle. Folding them in would put a
 * timeout knob on the Joi schema of an admin endpoint and leave
 * DAILY_CROSSWORD_OPTIONS naming a number it only ever wants the default of.
 */
export const generateCrossword = async (
  options: CrosswordGenerationOptions,
  controls: GenerateControls = {},
): Promise<GenerateResult | GenerateFailure> => {
  const size = options.size;
  const start = Date.now();
  const budgetMs = controls.budgetMs ?? DEFAULT_TOTAL_BUDGET_MS;
  const deadline = start + budgetMs;
  const rng = seedrandom(options.seed);

  const allowed = vocabularyForClasses(options.allowedClasses);
  const preferred = options.preferredClasses.filter((entryClass) => options.allowedClasses.includes(entryClass));
  // Preferred classes are the working vocabulary, not a tie-break. The acronym
  // budget is a few percent of entries while acronyms are ~87% of the
  // three-letter pool, so a solver allowed to reach for them fills grids that
  // have to be thrown away at the end. Dropping them costs depth at length 3
  // and buys a fill that respects the budget by construction; the full
  // vocabulary is still there for the tail of the clock.
  // `vocabularyForClasses` caches per class-set, so identical sets come back as
  // the same object and there is nothing to fall back to.
  const primary = preferred.length > 0 ? vocabularyForClasses(preferred) : allowed;
  const vocabs = primary === allowed ? [primary] : [primary, allowed];

  const themeTexts = options.themeFilterText ? themedCardTexts(options.themeFilterText) : null;
  const themes = new Map<Vocabulary, Set<number>>();
  for (const vocab of vocabs) {
    const indices = new Set<number>();
    if (themeTexts && themeTexts.size > 0) {
      vocab.entries.forEach((entry, index) => {
        if (entry.entryClass === 'cardName' && themeTexts.has(entry.text)) {
          indices.add(index);
        }
      });
    }
    themes.set(vocab, indices);
  }
  const themeSize = themes.get(vocabs[0]!)!.size;

  const interior = size <= MAX_INTERIOR_SEED_SIZE ? INTERIOR_SEED_LINES : 0;
  const plan = framePlan(size, options.minWordLength, interior, INTERIOR_SEED_INSET);
  if (!plan) {
    return {
      reason: `A ${size}x${size} grid with a minimum word length of ${options.minWordLength} has no room for ${MIN_FULL_LENGTH_PER_DIRECTION} full-length entries in each direction.`,
      blocksAdded: 0,
    };
  }
  // Every seeded line needs an entry of its own length, all distinct. Short of
  // that every attempt fails for the same reason at the same point, so the whole
  // budget would go on re-proving it; answer now instead.
  const needed = new Map<number, number>();
  for (const slot of [...plan.rows, ...plan.cols]) {
    const length = size - 2 * slot.inset;
    needed.set(length, (needed.get(length) ?? 0) + 1);
  }
  for (const [length, count] of needed) {
    const pool = Math.max(...vocabs.map((vocab) => vocab.byLength.get(length)?.length ?? 0));
    if (pool < count) {
      return {
        reason: `The vocabulary has ${pool} ${length}-letter entries, and ${plan.label} needs ${count}.`,
        blocksAdded: 0,
      };
    }
  }
  // The preferred vocabulary gets almost all of the budget: reaching for
  // acronyms costs depth in the search (their three-letter pool is eight times
  // larger, so the exact run check stops paying for itself) and the grid it
  // finds usually breaks the acronym budget anyway. It is a last resort, not an
  // alternative, so it only gets the tail of the clock.
  const fallbackFrom = start + budgetMs * 0.8;

  let fillSteps = 0;
  let reason = 'no layout could be seeded at all';
  let vocabIndex = 0;
  let seedingMisses = 0;
  let attempt = 0;
  // Wrapped once rather than per attempt: `attempt` is read at call time, so the
  // closure stays correct as the loop advances. Left undefined when nobody is
  // listening, so `runWfc` skips its gate entirely.
  const onProgress = controls.onProgress
    ? (progress: WfcProgress) => controls.onProgress!({ ...progress, size, attempt, elapsedMs: Date.now() - start })
    : undefined;

  while (Date.now() < deadline) {
    // `runWfc` yields whenever it emits a snapshot, which covers the time spent
    // collapsing — but not the time spent *between* collapses. A seeding miss
    // never reaches the collapse loop, and neither does an attempt whose seeds
    // contradict each other on contact, so a run of those would otherwise be an
    // unbroken block with no line getting out. One turn per attempt bounds that;
    // against an attempt's ATTEMPT_BUDGET_MS it is free, and without a viewer
    // it doesn't happen at all.
    if (onProgress) {
      await yieldToEventLoop();
    }
    if (vocabIndex === 0 && vocabs.length > 1 && Date.now() >= fallbackFrom) {
      vocabIndex = 1;
    }
    const vocab = vocabs[vocabIndex]!;
    const theme = themes.get(vocab)!;

    const seeds = findSeedEntries(vocab, size, plan, theme, rng);
    if (!seeds) {
      reason = `couldn't find ${plan.label} whose entries agree where they cross`;
      seedingMisses += 1;
      if (seedingMisses >= SEEDING_MISSES_BEFORE_GIVING_UP) {
        // A wider vocabulary has more full-length entries to frame with, so it is
        // worth asking before giving up; once it has missed too, nothing left in
        // the budget can change the answer.
        if (vocabIndex + 1 >= vocabs.length) {
          break;
        }
        vocabIndex += 1;
        seedingMisses = 0;
      }
      continue;
    }
    seedingMisses = 0;
    attempt += 1;

    const result = await runWfc({
      size,
      symmetry: options.symmetry,
      minWordLength: options.minWordLength,
      vocab,
      seeds,
      maxAcronymRatio: options.maxAcronymRatio,
      rng,
      deadline: Math.min(deadline, Date.now() + ATTEMPT_BUDGET_MS),
      maxSteps: MAX_STEPS,
      onProgress,
    });
    fillSteps += result.steps;

    if (isWfcFailure(result)) {
      reason = `${plan.label}: ${result.reason}`;
      continue;
    }

    // What the plan promised, read back off the finished grid rather than assumed
    // from the seeding. The seeded lines are full-length by construction, so this
    // should never fire — but it is the guarantee the whole attempt loop exists to
    // make, and a plan or a fill that stopped keeping it would otherwise ship
    // silently, which is the failure mode being fixed.
    const fullAcross = result.slots.filter((slot) => slot.length === size && slot.direction === 'across').length;
    const fullDown = result.slots.filter((slot) => slot.length === size && slot.direction === 'down').length;
    if (fullAcross < MIN_FULL_LENGTH_PER_DIRECTION || fullDown < MIN_FULL_LENGTH_PER_DIRECTION) {
      reason = `${plan.label} filled, but the grid carried only ${fullAcross} full-length across and ${fullDown} down`;
      continue;
    }

    const blockCount = result.blocks.reduce((total, row) => total + row.filter(Boolean).length, 0);

    // Likewise the entry ceiling, read back off the finished grid. The generator
    // clears it by a wide margin at every size, so this should never fire either,
    // and it is here for the same reason: a fill that regressed to a grid of
    // three-letter entries would otherwise ship without saying so.
    const maxEntries = maxEntriesFor(size * size - blockCount);
    if (result.slots.length > maxEntries) {
      reason = `${plan.label} filled, but its ${result.slots.length} entries exceed the ${maxEntries} that average ${TARGET_MEAN_ENTRY_LENGTH} letters`;
      continue;
    }

    return {
      grid: {
        width: size,
        height: size,
        blockCount,
        blocks: result.blocks,
        letters: result.letters,
        slots: result.slots,
      },
      blocksAdded: blockCount,
      fillSteps,
      acronymsUsed: result.acronymsUsed,
      themeSize,
      durationMs: Date.now() - start,
    };
  }

  return {
    reason: `Gave up on ${MIN_FULL_LENGTH_PER_DIRECTION} full-length entries each way: ${reason}.`,
    blocksAdded: 0,
  };
};

export const isGenerateFailure = (result: GenerateResult | GenerateFailure): result is GenerateFailure =>
  (result as GenerateFailure).reason !== undefined;
