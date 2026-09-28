import { ALL_CROSSWORD_CLASSES, CrosswordGenerationOptions, CrosswordPuzzleGrid } from '@utils/datatypes/Crossword';
import seedrandom from 'seedrandom';

import { clueFor, getClueContext } from './clues';
import { generateCrossword, isGenerateFailure } from './generate';
import { chooseTheme, planFor, themePools } from './schedule';

/**
 * Builds the grid behind one day's puzzle: generate, clue, trim for storage.
 *
 * Split from board.ts because all of this needs the card catalog, the vocabulary
 * and the clue writer, and board.ts deliberately needs none of them.
 */

/**
 * Everything about the daily puzzle that doesn't vary by day.
 *
 * Size and theme do vary — see `WEEKLY_SCHEDULE` in schedule.ts, which ramps the
 * grid from Monday's 9 to Sunday's 16 and gives each weekday a different kind of
 * restriction. Symmetry, minimum word length and the acronym budget are the same
 * every day: they are what a Magic crossword *is*, not what makes one day harder
 * than another. Acronyms stay available but unpreferred, as in the lab — there
 * are thousands at three letters and they would otherwise take every short slot.
 */
export const DAILY_CROSSWORD_BASE: Omit<CrosswordGenerationOptions, 'seed' | 'size' | 'themeFilterText'> = {
  symmetry: 'rotational180',
  minWordLength: 3,
  maxAcronymRatio: 0.1,
  allowedClasses: [...ALL_CROSSWORD_CLASSES],
  preferredClasses: ALL_CROSSWORD_CLASSES.filter((entryClass) => entryClass !== 'acronym'),
};

/**
The ladder a date is tried on, in order, and what each rung may spend.
 *
 * Six short themed rungs and then a themeless one. Each themed rung redraws the
 * theme as well as the seed, because a day that can't be filled is usually a day
 * whose drawn theme can't frame the grid — retrying the same theme with a new
 * seed re-asks a question already answered. The last rung drops the theme: a
 * themed puzzle is the goal, but a day with no puzzle at all is worse than a day
 * with an unthemed one, and that trade is the whole reason this is a ladder.
 *
 * The rungs are short and many rather than long and few, which is measured
 * rather than assumed. Generation outcomes are bimodal: at 16x16 every success
 * landed in 1.2-6.3 seconds while every failure burned its entire budget. A long
 * rung therefore buys almost no extra successes and spends the whole ladder's
 * time proving one drawn theme hopeless. Lengthening the per-attempt slice was
 * tried directly and made things worse (16x16 went 6/12 to 4/12 when
 * ATTEMPT_BUDGET_MS went 800 -> 3000). Many short draws beat few long ones
 * because they are independent questions, not one asked patiently.
 *
 * Three seconds is where that argument bottoms out, measured at 16x16: every
 * success in a Sunday sample landed at 122ms, 750ms or 2590ms, while every
 * failure burned its whole slice to manage only ~300 collapse steps. Past about
 * three seconds a rung is no longer deciding anything, so the scarce resource is
 * the number of theme draws rather than the time each gets — and the same 44
 * seconds buys twelve of them instead of six.
 *
 * The total is bounded by a ceiling nothing else in this subsystem names:
 * `index.ts` puts a 60-second `res.setTimeout` on every request, and the rotate
 * endpoint the daily jobs lambda calls is a request. The lambda's own timeout is
 * 15 minutes and is not the binding constraint — this is. The rungs below total
 * 44 seconds, leaving room for the theme draws and the Dynamo write.
 */
interface DailyRung {
  themed: boolean;
  /** Distinguishes the theme draw as well as the grid seed. */
  attempt: number;
  budgetMs: number;
}

export const DAILY_RUNGS: readonly DailyRung[] = [
  { themed: true, attempt: 1, budgetMs: 3_000 },
  { themed: true, attempt: 2, budgetMs: 3_000 },
  { themed: true, attempt: 3, budgetMs: 3_000 },
  { themed: true, attempt: 4, budgetMs: 3_000 },
  { themed: true, attempt: 5, budgetMs: 3_000 },
  { themed: true, attempt: 6, budgetMs: 3_000 },
  { themed: true, attempt: 7, budgetMs: 3_000 },
  { themed: true, attempt: 8, budgetMs: 3_000 },
  { themed: true, attempt: 9, budgetMs: 3_000 },
  { themed: true, attempt: 10, budgetMs: 3_000 },
  { themed: true, attempt: 11, budgetMs: 3_000 },
  { themed: true, attempt: 12, budgetMs: 3_000 },
  { themed: false, attempt: 13, budgetMs: 8_000 },
];

/** What the whole ladder may spend, against the 60s request timeout in index.ts. */
export const DAILY_LADDER_BUDGET_MS = DAILY_RUNGS.reduce((total, rung) => total + rung.budgetMs, 0);

const seedFor = (date: string, attempt: number): string => (attempt === 1 ? date : `${date}#${attempt}`);

/**
 * Attaches the clue text the client can't work out for itself.
 *
 * Every class is clued here rather than in the browser, because writing a clue
 * needs the vocabulary, the card catalog and the filter engine — server-side
 * structures far too large to ship. The rng is seeded off the puzzle seed and
 * consumed in slot order, so a seed reproduces its clues along with its grid.
 */
export const withClues = (grid: CrosswordPuzzleGrid, seed: string): CrosswordPuzzleGrid => {
  const rng = seedrandom(`${seed}:clues`);
  const ctx = getClueContext();
  return {
    ...grid,
    // Spread rather than assigned: a clue is the readable text plus, for the
    // filter-based classes, the filter text it translates (see CrosswordClue).
    slots: grid.slots.map((slot) => ({ ...slot, ...clueFor(slot.entry, rng, ctx) })),
  };
};

/**
 * The grid as it goes into Dynamo, with each entry cut down to the three fields
 * the game ever reads: `text` to check a guess against, `display` and
 * `entryClass` for the answer list a finished solver sees. The rest of a
 * CrosswordVocabEntry — the source-card pools, the set metadata, the frequency —
 * is generation-time bookkeeping that would otherwise sit in the item forever.
 *
 * `clueFilter` goes too. The daily game doesn't render Scryfall syntax, and the
 * filter is a more machine-readable route to the answer than the English is.
 */
export const storableGrid = (grid: CrosswordPuzzleGrid): CrosswordPuzzleGrid => ({
  width: grid.width,
  height: grid.height,
  blockCount: grid.blockCount,
  blocks: grid.blocks.map((row) => [...row]),
  letters: grid.letters.map((row) => [...row]),
  slots: grid.slots.map((slot) => ({
    id: slot.id,
    direction: slot.direction,
    row: slot.row,
    col: slot.col,
    length: slot.length,
    number: slot.number,
    nonsense: slot.nonsense,
    clue: slot.clue,
    entry: {
      text: slot.entry.text,
      display: slot.entry.display,
      entryClass: slot.entry.entryClass,
    },
  })),
});

export interface BuildFailure {
  reason: string;
}

export const isBuildFailure = (result: CrosswordPuzzleGrid | BuildFailure): result is BuildFailure =>
  (result as BuildFailure).reason !== undefined;

/**
 * The grid for one puzzle date: deterministic in the date, clued, and trimmed to
 * what is worth storing. Requires the card catalog to be loaded.
 *
 * Async because `generateCrossword` is, and `generateCrossword` is because the
 * lab needs to yield between progress snapshots to get them out of the socket.
 * Nothing here is awaited that isn't already resolved: no `onProgress` is passed,
 * so the collapse never yields and this is the same blocking loop it always was,
 * one microtask longer.
 */
export const buildDailyGrid = async (date: string): Promise<CrosswordPuzzleGrid | BuildFailure> => {
  const plan = planFor(date);
  const pools = themePools(date);
  let lastReason = 'no attempt ran';

  for (const rung of DAILY_RUNGS) {
    const seed = seedFor(date, rung.attempt);
    // Drawing the theme is a pass over the catalog per candidate, so it happens
    // out here rather than inside the generation budget it would otherwise eat.
    const theme = rung.themed ? chooseTheme(date, rung.attempt, plan, pools) : null;
    if (rung.themed && !theme) {
      // Not an error and not silent. A pool that can't supply a theme deep enough
      // to frame this size is a fact about the schedule, and it is the thing to
      // look at first if a weekday starts coming out unthemed.
      console.info(
        `Crossword ${date}: rung ${rung.attempt} found no ${plan.kind} theme with enough ${plan.size}-letter card names; falling through.`,
      );
      continue;
    }

    const started = Date.now();
    const result = await generateCrossword(
      {
        ...DAILY_CROSSWORD_BASE,
        size: plan.size,
        themeFilterText: theme?.filterText ?? '',
        seed,
      },
      { budgetMs: rung.budgetMs },
    );

    const describe = theme
      ? `${plan.size}x${plan.size} ${theme.kind} ${JSON.stringify(theme.filterText)} (${theme.spanningNames} ${plan.size}-letter names)`
      : `${plan.size}x${plan.size} themeless`;

    if (isGenerateFailure(result)) {
      lastReason = result.reason;
      console.info(
        `Crossword ${date}: rung ${rung.attempt} failed after ${Date.now() - started}ms — ${describe} — ${result.reason}`,
      );
      continue;
    }

    console.info(`Crossword ${date}: built on rung ${rung.attempt} in ${Date.now() - started}ms — ${describe}.`);
    return storableGrid(withClues(result.grid, seed));
  }

  return { reason: lastReason };
};
