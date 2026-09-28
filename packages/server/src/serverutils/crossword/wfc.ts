import { CrosswordFilledSlot, CrosswordSymmetry } from '@utils/datatypes/Crossword';

import { allRunsValid, isConnected, slotsFor, symmetricPartners } from './grid';
import { candidatesForPattern, Vocabulary } from './vocabulary';

/**
 * Wave-function collapse over letters *and* black squares.
 *
 * Every cell is a variable whose domain is a subset of {A..Z, block}, so the
 * block pattern is an output of the search rather than an input to it. The
 * price of that is that slots aren't known ahead of time, so propagation can't
 * just pattern-match fixed slots: it has to ask, per line, "can this line still
 * be cut into black squares and letter-runs that the vocabulary supports?".
 * That question is a small dynamic program, and it doubles as the domain
 * filter — see `reviseLine`.
 */

const BLOCK = 1 << 26;
const ALL_LETTERS = BLOCK - 1;
const ANY = BLOCK | ALL_LETTERS;
const LETTER_A = 65;

/**
 * How many values of the chosen cell get trial-propagated for
 * least-constraining-value ordering. A cell picked by min-entropy usually has a
 * handful of values left; capping keeps the rare wide-open cell affordable, at
 * the price of a search that can no longer prove a grid impossible — which is
 * why the caller re-seeds rather than waiting for an answer.
 */
const LCV_TRIALS = 6;

/**
 * Counting a cell's remaining letters is the wrong measure while the grid's
 * shape is still open, and dangerously so: "not black" costs a cell one value
 * where "black" costs it and its symmetric partner twenty-six each, so plain
 * least-constraining-value walks straight into a grid with no black squares —
 * i.e. a grid of full-length words, the one thing a Magic vocabulary cannot
 * interlock (there are ~1000 seven-letter entries where a crossword dictionary
 * has six figures).
 *
 * What a layout is actually worth is how many ways the vocabulary can fill it.
 * Assuming runs are independent that is `sum over runs of ln(entries of that
 * length) - (white cells) * ln(26)`, and since every white cell belongs to
 * exactly two runs it rewrites as a sum of per-run terms — `runValue` below.
 * Short runs score positively, long ones very negatively, which is the real
 * reason a crossword has black squares in it at all.
 *
 * That measure is blind to one thing: an all-black grid has exactly one filling
 * and so scores zero, beating any honest layout. Hence a bonus per white square,
 * and a hard ceiling on how black a grid may get.
 *
 * The bonus was 2 while the mid-length pools were thin. Adding name words
 * roughly doubled the supply at lengths 5-9, which made longer runs cheap enough
 * to pay for, so it now sits at 2.5 — worth about nine black squares at 11x11
 * for a second or so of extra search.
 *
 * 3 was tried twice. It used to be hopeless — 11x11 took ~9.4s and fell through
 * to the last rung of the ladder, coming out *blacker* rather than more open.
 * Dropping the name-word frequency floor to 1 (three times the supply at lengths
 * 3-5) changed that: 11x11 now fills in ~0.9-1.5s at 3 and averages about four
 * fewer black squares than at 2.5. It still isn't worth taking, because 13x13
 * goes from ~1s to 1.8-3.4s for no block win the noise can distinguish, and that
 * is most of the headroom under the request budget spent on nothing.
 */
const WHITE_BONUS = 2.5;

/**
 * Charged per letter-run the layout is cut into, on top of what that run is worth
 * to fill.
 *
 * Every white cell belongs to exactly one across run and one down run, so entry
 * lengths sum to twice the white count and `mean length = 2 * white / runs`
 * identically: how long the entries come out is a property of the run count and of
 * nothing else. The rest of this scorer has no opinion on that count — `runValue`
 * prices each run on its own and `WHITE_BONUS` prices cells — so a line cut into
 * three short runs and the same line left as one long one are compared on
 * fillability alone, and the short cut wins every time. Half of an 11x11's entries
 * were three letters long because of that.
 *
 * Note what this is *not*: a reward for length. `+B per cell over minWordLength` was
 * tried and was catastrophic — it rewrites as `2B * white - 3B * runs`, so it pays
 * for openness as much as for length, the grids it liked could not be filled, and
 * the search fell back to short runs everywhere (75.6% three-letter entries at
 * 11x11). A flat charge per run is the same trade with that white-cell subsidy taken
 * out, and it is the half that does the work. It also costs nothing to place a block
 * that *doesn't* cut a line — one clustered against another, or hard against an edge
 * — so the black squares it steers towards are the ones a crossword actually has.
 *
 * The value is bounded on both sides and the gap between the bounds is narrow. Below,
 * by the arithmetic: at 11x11 the pools make a 3+3+3 line worth 15.7 against 11.9 for
 * 5+5, so three runs stop being the bargain at C > 3.7. Above, by the fill: at C = 7
 * the grids the scorer prefers stop being fillable (13x13 delivers 2 grids in 6 and
 * 14x14 none in 6). 5 sits inside that.
 *
 * It only bites at 11x11, and the same arithmetic says why. A 9x9 line cannot hold
 * three runs at all (3+3+3 needs eleven cells) and a 13x13 or 14x14 line pays less to
 * hold them, so the crossover there is C > 6.3 — above where the fill gives out. At
 * 11x11 it is worth mean entry length 4.07 -> 4.26 and three-letter entries 65.8% ->
 * 56.0% of the grid for no measurable time; at the other three sizes it does nothing
 * either way, which is the honest reason it is a constant and not a function of size.
 *
 * The three numbers per line above are worth recomputing if the pools move: they are
 * `runValue` sums plus `WHITE_BONUS` per cell, halved per direction because a cell is
 * shared between its across run and its down run.
 */
const RUN_COST = 5;

const MAX_BLOCK_DENSITY = 0.45;
/** Weight on remaining letter choices; small enough to only break shape ties. */
const ENTROPY_WEIGHT = 0.02;
/** Charged against a run for the letters it has to pin down. Halved because
 * each white cell is shared between an across run and a down run. */
const LETTER_COST = Math.log(26) / 2;
/** Stands in for "no entry of this length exists", without poisoning the sums. */
const IMPOSSIBLE_RUN = -25;

/**
 * Budget, in entries scanned, for checking a run against the letters its cells
 * still allow rather than just against the letters they have already committed
 * to. See `refineRun`. Wide-open runs blow past this and are skipped, which
 * costs nothing: they have every letter available anyway.
 */
const EXACT_RUN_WORK = 3_000;

/** Collapse steps without reaching new depth before the search starts over. */
const RESTART_AFTER = 60;

/**
 * Collapse steps between progress snapshots, and the floor on the wall-clock gap
 * between two of them. Both have to be cleared, so the cheaper test comes first
 * and `Date.now()` is only reached on one step in `PROGRESS_EVERY_STEPS`.
 *
 * A snapshot is one pass over `cellCount` cells with a popcount each — tens of
 * microseconds at these sizes — against a collapse step that costs `LCV_TRIALS`
 * full propagations, so the step gate alone would already make it free. The time
 * gate is there for the consumer rather than the solver: the lab streams these to
 * a browser, and a grid redrawn more than ten times a second is a waste of both
 * ends. Measured at 16 steps / 100ms the cost is inside the run-to-run noise of
 * generation itself — see the timings in the commit that added this.
 */
const PROGRESS_EVERY_STEPS = 16;
const PROGRESS_MIN_INTERVAL_MS = 100;

/** Domains only ever shrink, so this is a safety net, not a real limit. */
const PROPAGATE_GUARD = 200_000;

/** Candidate pairs tried when looking for a corner-consistent theme frame. */
const FRAME_TRIES = 24;
const FRAME_CROSS_TRIES = 12;

interface SpanInfo {
  /** At least one entry matches the letters already fixed inside the span. */
  ok: boolean;
  /** Per position, the letters that some matching entry uses there. */
  masks: number[];
}

const NO_MATCH: SpanInfo = { ok: false, masks: [] };

/**
 * Span lookups are the hot path — a single grid asks for hundreds of thousands
 * of them — and the same partial patterns recur constantly, both inside one
 * grid and across the attempts a request makes. Keyed by pattern string, kept
 * per vocabulary for the process lifetime.
 */
const spanMemos = new WeakMap<Vocabulary, Map<string, SpanInfo>>();
const SPAN_MEMO_LIMIT = 300_000;

/** text -> entry index. The vocabulary is deduplicated by text, so this is 1:1. */
const textIndexes = new WeakMap<Vocabulary, Map<string, number>>();

const popcount = (value: number): number => {
  let v = value - ((value >> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
  v = (v + (v >> 4)) & 0x0f0f0f0f;
  return (v * 0x01010101) >> 24;
};

const soleLetter = (mask: number): number => {
  const letters = mask & ALL_LETTERS;
  return letters !== 0 && (letters & (letters - 1)) === 0 ? 31 - Math.clz32(letters) : -1;
};

const computeSpan = (vocab: Vocabulary, pattern: string[]): SpanInfo => {
  const candidates = candidatesForPattern(vocab, pattern);
  if (candidates.length === 0) {
    return NO_MATCH;
  }
  const length = pattern.length;
  const masks = new Array<number>(length).fill(0);
  for (let i = 0; i < candidates.length; i++) {
    const text = vocab.entries[candidates[i]!]!.text;
    for (let p = 0; p < length; p++) {
      masks[p] = masks[p]! | (1 << (text.charCodeAt(p) - LETTER_A));
    }
    // A wide-open span has tens of thousands of candidates and saturates every
    // position within the first few; the rest cannot narrow anything.
    if ((i & 31) === 31) {
      let full = 0;
      for (let p = 0; p < length; p++) {
        if (masks[p] === ALL_LETTERS) full += 1;
      }
      if (full === length) break;
    }
  }
  return { ok: true, masks };
};

const memoFor = (vocab: Vocabulary): Map<string, SpanInfo> => {
  let memo = spanMemos.get(vocab);
  if (!memo) {
    memo = new Map();
    spanMemos.set(vocab, memo);
  }
  return memo;
};

const indexFor = (vocab: Vocabulary): Map<string, number> => {
  let index = textIndexes.get(vocab);
  if (!index) {
    index = new Map();
    vocab.entries.forEach((entry, position) => index!.set(entry.text, position));
    textIndexes.set(vocab, index);
  }
  return index;
};

/** A long entry laid down before the search starts, filling a whole line. */
export interface SeedLine {
  down: boolean;
  /** Row index for an across line, column index for a down line. */
  at: number;
  /** Where along the line the entry starts. Cells outside it are black. */
  from: number;
  entry: number;
}

/**
 * One line a seeding attempt wants to hold a single long entry, and how far from
 * the grid's edge that entry starts.
 *
 * An inset of zero is a full-length entry, edge to edge. A positive inset is the
 * same idea one step weaker: the entry spans `size - 2 * inset` cells and the
 * `inset` cells at each end are black, so the line still holds exactly one entry
 * without having to find a word as wide as the grid. That matters because a
 * full-length line drags its neighbours open — see the offset discussion in
 * `framePlan` — where an inset line brings its own black squares with it.
 *
 * The inset is kept below `minWordLength`, so the cells it blacks out could not
 * have held an entry of their own anyway and the plan gives up nothing by
 * claiming them.
 */
export interface SeedSlot {
  at: number;
  inset: number;
}

/**
 * Which lines a seeding attempt wants to fill with single long theme entries.
 *
 * Rows and columns must each be closed under the grid's symmetry, otherwise the
 * partner line is forced open anyway and the plan is a lie about how many long
 * words the grid will carry.
 *
 * A row's black squares have to fall clear of every column the plan seeds, and
 * vice versa — a cell one line wants black and another wants lettered kills every
 * attempt at the same point. `framePlan` only builds plans where that holds.
 */
export interface SeedPlan {
  label: string;
  rows: SeedSlot[];
  cols: SeedSlot[];
}

/**
 * How far a candidate is from what the frame wants: on-theme card names, then any
 * card name, then everything else.
 *
 * Only the four frame entries are ranked this way, and only because they are the
 * puzzle's theme — a grid whose long entries are off-theme name fragments is a
 * word square, whatever the request asked for.
 *
 * `cardName` beats the rest off-theme because a long slot is the one place a whole
 * card name fits, and a clue naming a real card is worth more there than a pair of
 * words blanked out of one. Bigrams are interior fill, and this is what keeps them
 * there.
 */
const frameLevel = (vocab: Vocabulary, index: number, theme: Set<number>): number => {
  if (theme.has(index)) {
    return 0;
  }
  return vocab.entries[index]!.entryClass === 'cardName' ? 1 : 2;
};

const THEME_ONLY = 0;
const ANY_ENTRY = 2;

/**
 * How far each rung of the frame search will go, rows first, then columns.
 *
 * Strictly decreasing in how themed the frame is, and the first rung that finds a
 * corner-consistent frame wins, so on-theme candidates are exhausted before an
 * off-theme one is considered:
 *
 * - all four on-theme;
 * - both rows on-theme, columns whatever crosses them (so never fewer than two);
 * - anything, still ordered theme-first, for a theme too thin to frame at all.
 *
 * Three rungs and not five: a rung that fails costs a whole bounded frame search,
 * and the seeding loop in generate.ts runs this up to 64 times before giving up.
 * The middle rung is the one that earns its keep — it is the difference between a
 * narrow theme delivering two long themed entries and delivering however many the
 * crossings happened to allow.
 */
const FRAME_RUNGS: { rows: number; cols: number }[] = [
  { rows: THEME_ONLY, cols: THEME_ONLY },
  { rows: THEME_ONLY, cols: ANY_ENTRY },
  { rows: ANY_ENTRY, cols: ANY_ENTRY },
];

/**
 * Up to `limit` candidates, lowest level first and random within a level.
 *
 * Only the first `limit` of them are ever looked at (FRAME_TRIES), so this draws
 * exactly that many rather than assigning every candidate a random key and sorting
 * the lot — which is what it used to do, at a cost of one rng call per entry of the
 * length, five thousand of them, for each of the twenty-four it then used. That was
 * affordable when the frame search ran once; it runs up to three times now.
 */
const orderedSample = (
  indices: number[],
  levelOf: (index: number) => number,
  rng: () => number,
  limit: number,
): number[] => {
  const buckets = new Map<number, number[]>();
  for (const index of indices) {
    const level = levelOf(index);
    const bucket = buckets.get(level);
    if (bucket) {
      bucket.push(index);
    } else {
      buckets.set(level, [index]);
    }
  }

  const sample: number[] = [];
  for (const level of [...buckets.keys()].sort((a, b) => a - b)) {
    const bucket = [...buckets.get(level)!];
    const take = Math.min(limit - sample.length, bucket.length);
    // Partial Fisher-Yates: the first `take` positions end up a uniform draw.
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(rng() * (bucket.length - i));
      const swap = bucket[i]!;
      bucket[i] = bucket[j]!;
      bucket[j] = swap;
      sample.push(bucket[i]!);
    }
    if (sample.length >= limit) {
      break;
    }
  }
  return sample;
};

/**
 * Picks long entries for the planned lines such that they agree wherever an across
 * line crosses a down line.
 *
 * The lines are taken one at a time, alternating across and down, and each is
 * looked up by the letters the lines already chosen have pinned inside it. That
 * alternation is the whole of why a plan can seed more than four lines. Choosing
 * every row first and then asking the columns to thread all of them — which is what
 * this did, and which is fine for two rows — makes the last column carry one fixed
 * letter per row: with four rows that is four letters out of eleven, which about one
 * eleven-letter entry in ten thousand satisfies, so the frame is never found.
 * Alternating spreads the same constraints out, and no line is ever looked up
 * against more than half of them.
 *
 * `used` is threaded through rather than checked at the end because the same entry
 * fitting two lines is common at these lengths, and a frame that repeats itself is
 * thrown out by `finalize` after the whole grid has been filled around it.
 *
 * The search runs once per rung (see FRAME_RUNGS), so on-theme entries are
 * *exhausted* before an off-theme one is considered anywhere in the frame. Sorting
 * one combined pool theme-first — which is what this did — is not the same thing:
 * the first frame that agreed at its crossings was taken, and a frame of two themed
 * rows and two unthemed columns agrees far more often than a fully themed one. That
 * is where the missing theme entries were going, and adding tens of thousands of
 * bigrams at these lengths would have made it worse by handing the search more
 * filler.
 *
 * Only the full-length lines are held to the rung. The inset lines are there for
 * the grid's shape rather than its theme — they are the mechanism that keeps entry
 * lengths up, see `framePlan` — and holding them to a theme too would make the
 * whole frame fail together, taking the four themed entries down with it. They are
 * still drawn theme-first within their pool, so they are themed when the crossings
 * allow it.
 */
export const findSeedEntries = (
  vocab: Vocabulary,
  size: number,
  plan: SeedPlan,
  theme: Set<number>,
  rng: () => number,
): SeedLine[] | null => {
  if (plan.rows.length === 0 && plan.cols.length === 0) {
    return [];
  }
  const lengthOf = (slot: SeedSlot): number => size - 2 * slot.inset;
  const poolFor = (slot: SeedSlot): number[] => vocab.byLength.get(lengthOf(slot)) ?? [];
  if ([...plan.rows, ...plan.cols].some((slot) => poolFor(slot).length === 0)) {
    return null;
  }
  const textOf = (index: number): string => vocab.entries[index]!.text;
  const levels = new Map<number, number>();
  const levelOf = (index: number): number => {
    let level = levels.get(index);
    if (level === undefined) {
      level = frameLevel(vocab, index, theme);
      levels.set(index, level);
    }
    return level;
  };

  // Across and down interleaved, so a line is never looked up against more than the
  // crossings already decided. The two directions can differ in length when a plan
  // seeds an uneven number of lines; the shorter one simply runs out.
  const order: { slot: SeedSlot; down: boolean }[] = [];
  for (let i = 0; i < Math.max(plan.rows.length, plan.cols.length); i++) {
    if (i < plan.rows.length) {
      order.push({ slot: plan.rows[i]!, down: false });
    }
    if (i < plan.cols.length) {
      order.push({ slot: plan.cols[i]!, down: true });
    }
  }

  const attempt = (rung: { rows: number; cols: number }): SeedLine[] | null => {
    const chosen: SeedLine[] = [];
    const taken = new Set<string>();
    let budget = FRAME_TRIES * FRAME_CROSS_TRIES;

    const choose = (depth: number): SeedLine[] | null => {
      if (depth === order.length) {
        return [...chosen];
      }
      const { slot, down } = order[depth]!;
      const pattern = Array.from({ length: lengthOf(slot) }, () => '');
      for (const line of chosen) {
        if (line.down === down) {
          continue;
        }
        // They run at right angles, so each one's index along itself is the other
        // one's position across it. A letter is pinned only where both reach.
        if (line.at < slot.inset || line.at >= size - slot.inset) {
          continue;
        }
        if (slot.at < line.from || slot.at >= size - line.from) {
          continue;
        }
        pattern[line.at - slot.inset] = textOf(line.entry)[slot.at - line.from]!;
      }

      const cap = slot.inset === 0 ? (down ? rung.cols : rung.rows) : ANY_ENTRY;
      const matches = orderedSample(
        candidatesForPattern(vocab, pattern).filter((index) => levelOf(index) <= cap),
        levelOf,
        rng,
        depth === 0 ? FRAME_TRIES : FRAME_CROSS_TRIES,
      );
      for (const candidate of matches) {
        const text = textOf(candidate);
        if (taken.has(text)) {
          continue;
        }
        budget -= 1;
        taken.add(text);
        chosen.push({ down, at: slot.at, from: slot.inset, entry: candidate });
        const lines = choose(depth + 1);
        chosen.pop();
        taken.delete(text);
        if (lines) {
          return lines;
        }
        if (budget <= 0) {
          return null;
        }
      }
      return null;
    };
    return choose(0);
  };

  // The rung caps only bite on the full-length lines, so that is what deciding
  // whether a rung is worth running looks at.
  const frameSlots = plan.rows.concat(plan.cols).filter((slot) => slot.inset === 0);
  let ran: { cols: number; rows: number } | undefined;
  for (const rung of FRAME_RUNGS) {
    const eligible = frameSlots.reduce(
      (total, slot) => total + poolFor(slot).filter((index) => levelOf(index) <= rung.rows).length,
      0,
    );
    // A rung with nothing to draw the frame from, or that would repeat the rung
    // before it, is skipped. A themeless request has an empty level 0, so it goes
    // straight to the last rung and costs exactly what this used to.
    if (eligible === 0 || (ran && ran.cols === rung.cols && ran.rows === eligible)) {
      continue;
    }
    ran = { cols: rung.cols, rows: eligible };
    const lines = attempt(rung);
    if (lines) {
      return lines;
    }
  }
  return null;
};

/**
 * A mid-collapse look at the grid, cheap enough to send somewhere and complete
 * enough to draw.
 *
 * `cells` is row-major, one number per cell, and the encoding is deliberately
 * flat so it survives JSON without a schema:
 *
 * - `-1` — decided black.
 * - `0` — collapsed: one letter and no black square left. What that letter is
 *   isn't here; a viewer that wants it has to ask for the finished grid.
 * - `1..26` — undecided, and the count is how many letters the cell still
 *   allows. 26 is wide open, 1 is a letter all but chosen.
 *
 * Note the 1: a cell can be down to a single letter and still be undecided,
 * because "black" is a value in the domain too and that one hasn't been ruled
 * out. It is a real state and a common one during shaping, so it gets a real
 * number rather than being rounded up into 2 — `0` is reserved for "the shape is
 * settled and it is a letter", which is a different thing entirely.
 */
export interface WfcProgress {
  cells: number[];
  /** Collapse steps taken so far in this call. */
  steps: number;
  /** Times this call has thrown its branch away and started over (RESTART_AFTER). */
  restarts: number;
}

export interface WfcParams {
  size: number;
  symmetry: CrosswordSymmetry;
  minWordLength: number;
  vocab: Vocabulary;
  seeds: SeedLine[];
  maxAcronymRatio: number;
  rng: () => number;
  deadline: number;
  maxSteps: number;
  /**
   * Called periodically during the collapse with a snapshot of the grid. See
   * PROGRESS_EVERY_STEPS for the cadence and WfcProgress for the encoding.
   *
   * The snapshot is freshly allocated per call, so a consumer may keep it. The
   * view it gives jumps backwards on a restart and on a deep backtrack, which is
   * the search working rather than a glitch — hence `restarts`.
   */
  onProgress?: (progress: WfcProgress) => void;
}

export interface WfcResult {
  blocks: boolean[][];
  letters: string[][];
  slots: CrosswordFilledSlot[];
  steps: number;
  acronymsUsed: number;
}

export interface WfcFailure {
  reason: string;
  steps: number;
}

export const isWfcFailure = (result: WfcResult | WfcFailure): result is WfcFailure =>
  (result as WfcFailure).reason !== undefined;

interface Frame {
  before: Int32Array;
  /** Propagated states for each value, best-scoring first. */
  options: Int32Array[];
  next: number;
}

/**
 * Hands the event loop one full turn, which is the only way a progress snapshot
 * that has been written actually reaches the client.
 *
 * `res.write` looks like it sends, and it doesn't. The first write on an HTTP
 * response corks the socket and schedules the matching uncork on
 * `process.nextTick` (see `write_` in node's _http_outgoing.js), so every line a
 * blocking loop writes piles up in the socket's buffer and goes out in one burst
 * when the handler finally returns. Measured on this endpoint before this
 * existed: twenty-two snapshots written across 2209ms of generation, all twenty-
 * two delivered inside the same 4ms once it finished. `res.write` returned true
 * every time — true means "buffered", not "sent".
 *
 * `setImmediate` rather than a bare promise because a microtask would drain the
 * nextTick queue and uncork, but would not get as far as the poll phase: this
 * also lets the process notice the client hanging up, and serve somebody else.
 * That second part is worth having, since a lab request can block this process
 * for three minutes (see LAB_BUDGET_MS).
 */
export const yieldToEventLoop = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve));

export const runWfc = async (params: WfcParams): Promise<WfcResult | WfcFailure> => {
  const { size, symmetry, minWordLength: minLen, vocab, rng, deadline } = params;
  const cellCount = size * size;
  const memo = memoFor(vocab);
  const byText = indexFor(vocab);
  const maxBlocks = Math.floor(cellCount * MAX_BLOCK_DENSITY);

  const domains = new Int32Array(cellCount).fill(ANY);

  // Lines 0..size-1 are rows, size..2*size-1 are columns.
  const lineCells: number[][] = [];
  for (let row = 0; row < size; row++) {
    lineCells.push(Array.from({ length: size }, (_, col) => row * size + col));
  }
  for (let col = 0; col < size; col++) {
    lineCells.push(Array.from({ length: size }, (_, row) => row * size + col));
  }

  const partnersOf: number[][] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const self = row * size + col;
      partnersOf.push(
        symmetricPartners(row, col, size, size, symmetry)
          .map(([r, c]) => r * size + c)
          .filter((cell) => cell !== self),
      );
    }
  }

  const lineQueued = new Uint8Array(2 * size);
  const lineQueue: number[] = [];
  const cellQueued = new Uint8Array(cellCount);
  const cellQueue: number[] = [];

  const pushLine = (line: number): void => {
    if (!lineQueued[line]) {
      lineQueued[line] = 1;
      lineQueue.push(line);
    }
  };

  const touch = (cell: number): void => {
    pushLine((cell / size) | 0);
    pushLine(size + (cell % size));
    if (!cellQueued[cell]) {
      cellQueued[cell] = 1;
      cellQueue.push(cell);
    }
  };

  const clearQueues = (): void => {
    for (const line of lineQueue) {
      lineQueued[line] = 0;
    }
    lineQueue.length = 0;
    for (const cell of cellQueue) {
      cellQueued[cell] = 0;
    }
    cellQueue.length = 0;
  };

  const canBlock = new Uint8Array(size);
  const canLetter = new Uint8Array(size);
  const startOk = new Uint8Array(size + 1);
  const runEnd = new Uint8Array(size + 1);
  const bwd = new Uint8Array(size + 1);
  const letterMask = new Int32Array(size);
  // Spans shared between the DP passes of one line revision, keyed by
  // (start, length). Only valid while the line's domains hold still.
  const spanSlots: (SpanInfo | undefined)[] = new Array(size * (size + 1));
  const patterns: string[][] = Array.from({ length: size + 1 }, (_, length) => Array.from({ length }, () => ''));

  const spanFor = (cells: number[], start: number, length: number): SpanInfo => {
    const slot = start * (size + 1) + length;
    const cached = spanSlots[slot];
    if (cached) {
      return cached;
    }
    const pattern = patterns[length]!;
    let key = '';
    for (let p = 0; p < length; p++) {
      const letter = soleLetter(domains[cells[start + p]!]!);
      if (letter < 0) {
        pattern[p] = '';
        key += '.';
      } else {
        const char = String.fromCharCode(LETTER_A + letter);
        pattern[p] = char;
        key += char;
      }
    }
    let info = memo.get(key);
    if (!info) {
      info = computeSpan(vocab, pattern);
      if (memo.size >= SPAN_MEMO_LIMIT) {
        memo.clear();
      }
      memo.set(key, info);
    }
    spanSlots[slot] = info;
    return info;
  };

  const runMask = new Int32Array(size);

  /**
   * Exact arc consistency for one run, once its length is known for certain.
   *
   * The span lookups above match a run against the letters its cells have
   * *committed* to, treating an undecided cell as a wildcard, because that is
   * what can be memoised. It is also weak: a run can have a candidate for every
   * cell taken singly and none that fits all of them at once. When the run's
   * boundaries are fixed, the candidates are few enough to check properly —
   * keep only the entries every one of whose letters is still available in the
   * cell that would hold it, and narrow the cells to what survives.
   */
  const refineRun = (cells: number[], start: number, length: number): boolean => {
    const pattern = patterns[length]!;
    let open = 0;
    for (let p = 0; p < length; p++) {
      const letter = soleLetter(domains[cells[start + p]!]!);
      if (letter < 0) {
        open += 1;
        pattern[p] = '';
      } else {
        pattern[p] = String.fromCharCode(LETTER_A + letter);
      }
    }
    // Nothing left to narrow, so the memoised span answer is the whole story.
    if (open === 0) {
      return spanFor(cells, start, length).ok;
    }
    const candidates = candidatesForPattern(vocab, pattern);
    if (candidates.length === 0) {
      return false;
    }
    if (candidates.length * length > EXACT_RUN_WORK) {
      return true;
    }
    runMask.fill(0, 0, length);
    let survivors = 0;
    for (const candidate of candidates) {
      const text = vocab.entries[candidate]!.text;
      let fits = true;
      for (let p = 0; p < length; p++) {
        if ((domains[cells[start + p]!]! & (1 << (text.charCodeAt(p) - LETTER_A))) === 0) {
          fits = false;
          break;
        }
      }
      if (!fits) {
        continue;
      }
      survivors += 1;
      for (let p = 0; p < length; p++) {
        runMask[p] = runMask[p]! | (1 << (text.charCodeAt(p) - LETTER_A));
      }
    }
    if (survivors === 0) {
      return false;
    }
    for (let p = 0; p < length; p++) {
      const cell = cells[start + p]!;
      const after = domains[cell]! & runMask[p]!;
      if (after === 0) {
        return false;
      }
      if (after !== domains[cell]) {
        domains[cell] = after;
        touch(cell);
      }
    }
    return true;
  };

  /**
   * Decides whether a line can still be cut into black squares and legal
   * letter-runs, and narrows every cell on it to the values some such cut
   * allows.
   *
   * Two forward states are needed, not one. `startOk[i]` means "cells 0..i-1 are
   * validly cut and cell i may open a run or be black"; `runEnd[i]` means "a run
   * ends at i-1", which leaves cell i no choice but to be black. Collapsing
   * those into a single state is the obvious simplification and it is wrong: it
   * makes a cell unblockable whenever the only reason it would be black is to
   * terminate the run in front of it, which is most of the black squares in a
   * crossword. The grid then has nowhere to put them and fills with
   * full-length words instead.
   *
   * `bwd[i]` is the mirror of `startOk` and needs no partner state, because a
   * run is always followed by a black square, never by another run.
   */
  const reviseLine = (line: number): boolean => {
    const cells = lineCells[line]!;
    const n = size;
    spanSlots.fill(undefined);
    for (let i = 0; i < n; i++) {
      const domain = domains[cells[i]!]!;
      canBlock[i] = (domain & BLOCK) !== 0 ? 1 : 0;
      canLetter[i] = (domain & ALL_LETTERS) !== 0 ? 1 : 0;
    }

    startOk.fill(0);
    runEnd.fill(0);
    startOk[0] = 1;
    for (let i = 0; i < n; i++) {
      if (runEnd[i] && canBlock[i]) {
        startOk[i + 1] = 1;
      }
      if (!startOk[i]) {
        continue;
      }
      if (canBlock[i]) {
        startOk[i + 1] = 1;
      }
      let run = 0;
      while (i + run < n && canLetter[i + run]) {
        run += 1;
      }
      for (let length = minLen; length <= run; length++) {
        const end = i + length;
        // A run has to stop at a black square or at the edge of the grid.
        if (end < n && !canBlock[end]) {
          continue;
        }
        if (spanFor(cells, i, length).ok) {
          runEnd[end] = 1;
        }
      }
    }
    if (!startOk[n] && !runEnd[n]) {
      return false;
    }

    bwd.fill(0);
    bwd[n] = 1;
    for (let i = n - 1; i >= 0; i--) {
      if (canBlock[i] && bwd[i + 1]) {
        bwd[i] = 1;
        continue;
      }
      let run = 0;
      while (i + run < n && canLetter[i + run]) {
        run += 1;
      }
      for (let length = minLen; length <= run; length++) {
        const end = i + length;
        if (end < n && (!canBlock[end] || !bwd[end + 1])) {
          continue;
        }
        if (spanFor(cells, i, length).ok) {
          bwd[i] = 1;
          break;
        }
      }
    }

    letterMask.fill(0);
    for (let i = 0; i < n; i++) {
      if (!startOk[i]) {
        continue;
      }
      let run = 0;
      while (i + run < n && canLetter[i + run]) {
        run += 1;
      }
      for (let length = minLen; length <= run; length++) {
        const end = i + length;
        if (end < n && (!canBlock[end] || !bwd[end + 1])) {
          continue;
        }
        const info = spanFor(cells, i, length);
        if (!info.ok) {
          continue;
        }
        for (let p = 0; p < length; p++) {
          letterMask[i + p] = letterMask[i + p]! | info.masks[p]!;
        }
      }
    }

    for (let i = 0; i < n; i++) {
      const cell = cells[i]!;
      const before = domains[cell]!;
      let after = before & letterMask[i]!;
      if (canBlock[i] && (startOk[i] || runEnd[i]) && bwd[i + 1]) {
        after |= BLOCK;
      }
      if (after === 0) {
        return false;
      }
      if (after !== before) {
        domains[cell] = after;
        touch(cell);
      }
    }

    // Runs whose black squares are already placed can be checked exactly. The
    // span cache is keyed on domains that the loop above has just narrowed, so
    // it has to go.
    spanSlots.fill(undefined);
    let start = -1;
    let bounded = true;
    for (let i = 0; i <= n; i++) {
      const domain = i < n ? domains[cells[i]!]! : BLOCK;
      if (i < n && (domain & BLOCK) === 0) {
        if (start < 0) {
          start = i;
        }
        continue;
      }
      const black = domain === BLOCK;
      if (start >= 0 && black && bounded && !refineRun(cells, start, i - start)) {
        return false;
      }
      bounded = black;
      start = -1;
    }
    return true;
  };

  /** A cell and its symmetric partners have to agree on being black. */
  const coupleCell = (cell: number): boolean => {
    for (const partner of partnersOf[cell]!) {
      const here = domains[cell]!;
      const there = domains[partner]!;
      const block = (here & BLOCK) !== 0 && (there & BLOCK) !== 0 ? BLOCK : 0;
      const letters = (here & ALL_LETTERS) !== 0 && (there & ALL_LETTERS) !== 0;
      const nextHere = (letters ? here & ALL_LETTERS : 0) | block;
      const nextThere = (letters ? there & ALL_LETTERS : 0) | block;
      if (nextHere === 0 || nextThere === 0) {
        return false;
      }
      if (nextHere !== here) {
        domains[cell] = nextHere;
        touch(cell);
      }
      if (nextThere !== there) {
        domains[partner] = nextThere;
        touch(partner);
      }
    }
    return true;
  };

  const propagate = (): boolean => {
    for (let guard = 0; guard < PROPAGATE_GUARD; guard++) {
      const cell = cellQueue.pop();
      if (cell !== undefined) {
        cellQueued[cell] = 0;
        if (!coupleCell(cell)) {
          return false;
        }
        continue;
      }
      const line = lineQueue.pop();
      if (line === undefined) {
        return true;
      }
      lineQueued[line] = 0;
      if (!reviseLine(line)) {
        return false;
      }
    }
    return false;
  };

  const stack = new Int32Array(cellCount);
  const seen = new Uint8Array(cellCount);

  /**
   * Cells that cannot be black all have to end up in one white region, and the
   * only cells they can reach through are those that might stay white. Cheap to
   * check, and it catches over-blocking long before the grid is finished.
   */
  const whiteRegionConnected = (): boolean => {
    let start = -1;
    let required = 0;
    for (let cell = 0; cell < cellCount; cell++) {
      if ((domains[cell]! & BLOCK) === 0) {
        required += 1;
        if (start < 0) {
          start = cell;
        }
      }
    }
    if (start < 0) {
      return true;
    }
    seen.fill(0);
    seen[start] = 1;
    let top = 0;
    stack[top++] = start;
    let found = 1;
    while (top > 0) {
      const cell = stack[--top]!;
      const row = (cell / size) | 0;
      const col = cell % size;
      for (let dir = 0; dir < 4; dir++) {
        const r = row + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
        const c = col + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
        if (r < 0 || r >= size || c < 0 || c >= size) {
          continue;
        }
        const next = r * size + c;
        if (seen[next] || (domains[next]! & ALL_LETTERS) === 0) {
          continue;
        }
        seen[next] = 1;
        stack[top++] = next;
        if ((domains[next]! & BLOCK) === 0) {
          found += 1;
        }
      }
    }
    return found === required;
  };

  const finishedTexts = new Set<string>();

  /**
   * No entry may appear twice. Checking finished runs as they appear turns a
   * duplicate into a normal contradiction; leaving it to the end would mean
   * throwing away whole grids, and with only a few hundred three-letter entries
   * a repeat is the rule rather than the exception.
   */
  const noRepeatedRuns = (): boolean => {
    finishedTexts.clear();
    for (let line = 0; line < 2 * size; line++) {
      const cells = lineCells[line]!;
      let text = '';
      let closed = true;
      for (let i = 0; i <= size; i++) {
        const domain = i < size ? domains[cells[i]!]! : BLOCK;
        const letter = soleLetter(domain);
        if (letter >= 0 && (domain & BLOCK) === 0) {
          text += String.fromCharCode(LETTER_A + letter);
          continue;
        }
        if (text.length >= minLen && closed && domain === BLOCK) {
          if (finishedTexts.has(text)) {
            return false;
          }
          finishedTexts.add(text);
        }
        closed = domain === BLOCK;
        text = '';
      }
    }
    return true;
  };

  /** Past this the grid has more black squares than a crossword can carry. */
  const notTooBlack = (): boolean => {
    let blocks = 0;
    for (let cell = 0; cell < cellCount; cell++) {
      if (domains[cell] === BLOCK) {
        blocks += 1;
      }
    }
    return blocks <= maxBlocks;
  };

  const consistent = (): boolean => propagate() && notTooBlack() && whiteRegionConnected() && noRepeatedRuns();

  /**
   * Log-estimate of how many entries can fill a run of each length, net of the
   * letters it has to commit to. See WHITE_BONUS above for the derivation.
   */
  // BENCH: env override so one process can sweep every variant.
  const whiteBonus = Number(process.env.XW_WHITE_BONUS ?? WHITE_BONUS);

  const runValue = new Float64Array(size + 1);
  for (let length = 0; length <= size; length++) {
    const pool = length >= minLen ? (vocab.byLength.get(length)?.length ?? 0) : 0;
    runValue[length] = pool === 0 ? IMPOSSIBLE_RUN : Math.log(pool) - length * LETTER_COST;
  }

  /**
   * What the layout is worth so far, reading every cell whose shape is still
   * open as white. That makes the estimate pessimistic about run lengths, which
   * is what gives the very first decisions something to go on: before any black
   * square exists, every line reads as one full-length run.
   */
  const shapeValue = (): number => {
    let total = 0;
    let white = 0;
    let runs = 0;
    for (let cell = 0; cell < cellCount; cell++) {
      if (domains[cell] !== BLOCK) {
        white += 1;
      }
    }
    for (let line = 0; line < 2 * size; line++) {
      const cells = lineCells[line]!;
      let length = 0;
      for (let i = 0; i <= size; i++) {
        const domain = i < size ? domains[cells[i]!]! : BLOCK;
        if (i < size && domain !== BLOCK) {
          length += 1;
          continue;
        }
        if (length > 0) {
          total += runValue[length]!;
          runs += 1;
        }
        length = 0;
      }
    }
    return total + whiteBonus * white - RUN_COST * runs;
  };

  /** Remaining letter choices, used only to break ties between equal layouts. */
  const score = (): number => {
    let total = 0;
    for (let cell = 0; cell < cellCount; cell++) {
      const options = popcount(domains[cell]!);
      if (options > 1) {
        total += Math.log(options);
      }
    }
    return shapeValue() + ENTROPY_WEIGHT * total;
  };

  const settledInRow = new Int32Array(size);
  const settledInCol = new Int32Array(size);

  /** True while a cell could still turn out to be either black or a letter. */
  const shapeOpen = (domain: number): boolean => (domain & BLOCK) !== 0 && (domain & ALL_LETTERS) !== 0;

  /**
   * Min-entropy cell choice, taken over the shape of the grid before its
   * contents.
   *
   * Splitting the collapse that way is what makes the whole thing tractable.
   * While a line's black squares are undecided the domain filter has to allow
   * every letter that *any* possible run through a cell allows, which is nearly
   * every letter, so letters committed during that phase are barely checked at
   * all. Worse, propagation only ever removes possibilities, and "not black" is
   * far cheaper to satisfy than "black" — so a collapse that mixes the two
   * drifts into grids with almost no black squares, i.e. grids made of
   * full-length words, which is the one thing this vocabulary cannot fill. Once
   * every cell's shape is settled the runs are known, the filter becomes exact
   * per run, and what is left is an ordinary crossword fill.
   *
   * Ties go to the cell with the most settled neighbours on its own row and
   * column, so the collapse grows outwards from what is already committed.
   */
  const pickCell = (): number => {
    let shaping = false;
    for (let cell = 0; cell < cellCount; cell++) {
      if (shapeOpen(domains[cell]!)) {
        shaping = true;
        break;
      }
    }

    settledInRow.fill(0);
    settledInCol.fill(0);
    for (let cell = 0; cell < cellCount; cell++) {
      const settled = shaping ? !shapeOpen(domains[cell]!) : popcount(domains[cell]!) === 1;
      if (settled) {
        const row = (cell / size) | 0;
        const col = cell % size;
        settledInRow[row] = settledInRow[row]! + 1;
        settledInCol[col] = settledInCol[col]! + 1;
      }
    }

    let best = -1;
    let bestKey = Infinity;
    let ties = 0;
    for (let cell = 0; cell < cellCount; cell++) {
      const domain = domains[cell]!;
      // In the shaping phase every open cell has the same two-way choice, so
      // locality does all the ordering work.
      const options = shaping ? (shapeOpen(domain) ? 2 : 1) : popcount(domain);
      if (options <= 1) {
        continue;
      }
      const neighbours = settledInRow[(cell / size) | 0]! + settledInCol[cell % size]!;
      const key = options * 1000 - neighbours;
      if (key < bestKey) {
        bestKey = key;
        best = cell;
        ties = 1;
      } else if (key === bestKey) {
        ties += 1;
        if (rng() < 1 / ties) {
          best = cell;
        }
      }
    }
    return best;
  };

  const readGrid = (): { blocks: boolean[][]; letters: string[][] } => {
    const blocks: boolean[][] = [];
    const letters: string[][] = [];
    for (let row = 0; row < size; row++) {
      const blockRow: boolean[] = [];
      const letterRow: string[] = [];
      for (let col = 0; col < size; col++) {
        const domain = domains[row * size + col]!;
        blockRow.push(domain === BLOCK);
        letterRow.push(domain === BLOCK ? '' : String.fromCharCode(LETTER_A + soleLetter(domain)));
      }
      blocks.push(blockRow);
      letters.push(letterRow);
    }
    return { blocks, letters };
  };

  /** See WfcProgress for what the numbers mean. */
  const snapshot = (): number[] => {
    const cells = new Array<number>(cellCount);
    for (let cell = 0; cell < cellCount; cell++) {
      const domain = domains[cell]!;
      if (domain === BLOCK) {
        cells[cell] = -1;
        continue;
      }
      const letters = popcount(domain & ALL_LETTERS);
      cells[cell] = letters === 1 && (domain & BLOCK) === 0 ? 0 : letters;
    }
    return cells;
  };

  let steps = 0;

  const finalize = (): WfcResult | null => {
    const { blocks, letters } = readGrid();
    if (!allRunsValid(blocks, size, size, minLen) || !isConnected(blocks, size, size)) {
      return null;
    }
    const slots = slotsFor(blocks, size, size, minLen);
    if (slots.length === 0) {
      return null;
    }
    const maxAcronyms = Math.max(0, Math.floor(slots.length * params.maxAcronymRatio));

    const filled: CrosswordFilledSlot[] = [];
    const used = new Set<string>();
    let acronymsUsed = 0;
    for (const slot of slots) {
      let text = '';
      for (let i = 0; i < slot.length; i++) {
        text += slot.direction === 'across' ? letters[slot.row]![slot.col + i]! : letters[slot.row + i]![slot.col]!;
      }
      if (used.has(text)) {
        return null;
      }
      used.add(text);
      const index = byText.get(text);
      if (index === undefined) {
        return null;
      }
      const entry = vocab.entries[index]!;
      if (entry.entryClass === 'acronym') {
        acronymsUsed += 1;
        if (acronymsUsed > maxAcronyms) {
          return null;
        }
      }
      filled.push({ ...slot, entry });
    }

    return { blocks, letters, slots: filled, steps, acronymsUsed };
  };

  /**
   * Orders a cell's values least-constraining first by actually propagating
   * each one, and keeps the resulting states so the search never propagates the
   * same assignment twice.
   */
  const buildFrame = (cell: number, before: Int32Array): Frame => {
    const domain = before[cell]!;
    const values: number[] = [];
    if (shapeOpen(domain)) {
      // Shaping the grid is a two-way split of the domain rather than a single
      // value: "black" against "some letter, we'll say which later".
      values.push(BLOCK, domain & ALL_LETTERS);
    } else {
      let letters = domain;
      while (letters !== 0) {
        const bit = letters & -letters;
        values.push(bit);
        letters ^= bit;
      }
      // Shuffled so that an over-large domain gets sampled without bias.
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const swap = values[i]!;
        values[i] = values[j]!;
        values[j] = swap;
      }
    }

    const scored: { state: Int32Array; rank: number }[] = [];
    for (const value of values.slice(0, LCV_TRIALS)) {
      domains.set(before);
      domains[cell] = value;
      clearQueues();
      touch(cell);
      if (!consistent()) {
        continue;
      }
      scored.push({ state: domains.slice(), rank: score() });
    }
    domains.set(before);
    clearQueues();
    scored.sort((a, b) => b.rank - a.rank);
    return { before, options: scored.map((option) => option.state), next: 0 };
  };

  // Intersected rather than assigned, so that a plan whose rows and columns
  // disagree about a cell comes back as an ordinary contradiction instead of
  // whichever seed happened to be written last.
  for (const seed of params.seeds) {
    const text = vocab.entries[seed.entry]!.text;
    for (let i = 0; i < size; i++) {
      const cell = seed.down ? i * size + seed.at : seed.at * size + i;
      const position = i - seed.from;
      const wanted = position >= 0 && position < text.length ? 1 << (text.charCodeAt(position) - LETTER_A) : BLOCK;
      domains[cell] = domains[cell]! & wanted;
    }
  }

  clearQueues();
  for (let line = 0; line < 2 * size; line++) {
    pushLine(line);
  }
  for (let cell = 0; cell < cellCount; cell++) {
    touch(cell);
  }
  if (!consistent()) {
    return { reason: 'the seeded theme entries left no legal grid around them', steps };
  }

  const frames: Frame[] = [];
  let backtracking = false;
  let deepest = 0;
  let lastGain = 0;
  let restarts = 0;
  const { onProgress } = params;
  let nextProgressStep = 0;
  let lastProgressAt = 0;
  for (;;) {
    // Step gate first, so all but one iteration in PROGRESS_EVERY_STEPS costs an
    // integer compare and nothing else. Missing the time gate still moves the
    // step gate on, which is what makes the two of them "whichever is less
    // frequent" rather than a busy `Date.now()` once the step count is due.
    if (onProgress && steps >= nextProgressStep) {
      nextProgressStep = steps + PROGRESS_EVERY_STEPS;
      const now = Date.now();
      if (now - lastProgressAt >= PROGRESS_MIN_INTERVAL_MS) {
        lastProgressAt = now;
        onProgress({ cells: snapshot(), steps, restarts });
        // Yielding on exactly the snapshot's cadence, and not on the step gate
        // above it, is what keeps this affordable: one turn of the event loop per
        // snapshot delivered, so at most one per PROGRESS_MIN_INTERVAL_MS however
        // fast the collapse is running. There is nothing to yield *for* when no
        // snapshot was written, and `onProgress` is undefined on the daily path,
        // so that path never reaches this line and stays a straight blocking loop.
        await yieldToEventLoop();
      }
    }
    if (Date.now() > deadline) {
      return { reason: `ran out of time after ${steps} collapse steps and ${restarts} restarts`, steps };
    }
    if (steps >= params.maxSteps) {
      return { reason: `hit the step budget after ${steps} collapse steps`, steps };
    }

    if (!backtracking) {
      // Backtracking alone is a poor way out of a bad opening: the frames near
      // the root are the layout, and unwinding to them one sibling at a time
      // takes longer than the whole attempt is allowed. When the search stops
      // reaching new depth, throw the branch away and start over — the rng has
      // moved on, so the second run makes different choices.
      if (frames.length > 0 && steps - lastGain > RESTART_AFTER) {
        domains.set(frames[0]!.before);
        frames.length = 0;
        clearQueues();
        deepest = 0;
        lastGain = steps;
        restarts += 1;
      }
      const cell = pickCell();
      if (cell < 0) {
        const done = finalize();
        if (done) {
          return done;
        }
        backtracking = true;
        continue;
      }
      steps += 1;
      const frame = buildFrame(cell, domains.slice());
      if (frame.options.length === 0) {
        backtracking = true;
        continue;
      }
      frames.push(frame);
      if (frames.length > deepest) {
        deepest = frames.length;
        lastGain = steps;
      }
      domains.set(frame.options[frame.next++]!);
      clearQueues();
      continue;
    }

    let resumed = false;
    while (frames.length > 0) {
      const frame = frames[frames.length - 1]!;
      if (frame.next < frame.options.length) {
        domains.set(frame.options[frame.next++]!);
        resumed = true;
        break;
      }
      frames.pop();
      domains.set(frame.before);
    }
    if (!resumed) {
      return { reason: `exhausted every branch after ${steps} collapse steps and ${restarts} restarts`, steps };
    }
    clearQueues();
    backtracking = false;
  }
};
