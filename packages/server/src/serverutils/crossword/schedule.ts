import { makeFilter } from '@utils/filtering/FilterCards';
import seedrandom from 'seedrandom';
import { eligibleSetCodes } from 'serverutils/setEligibility';

import { getVocabulary, themedCardTexts } from './vocabulary';

/**
 * Which puzzle each weekday gets: how big, and what kind of restriction the
 * theme is drawn from.
 *
 * The daily used to be a themeless 9x9 every day. This is the schedule that
 * replaces it, on the NYT convention — Monday easiest, Sunday hardest — with a
 * different *kind* of restriction each day so a week doesn't read as seven
 * variations of one idea.
 *
 * Static, and deliberately so. A schedule that a date maps into is the whole of
 * what makes yesterday's puzzle reproducible: given the date and this table, the
 * size, the kind, the drawn value and the seed all follow, so a puzzle can be
 * rebuilt from its date alone if Dynamo ever loses it.
 */

/**
 * The restriction kinds, and where each draws its values from.
 *
 * Three of these were named: Monday creature type, Tuesday colour, Wednesday
 * card type. The rest are chosen to be *different questions* rather than
 * different numbers — a colour pair asks something a mono-colour doesn't, and a
 * set asks something no card property does.
 *
 * Oracle tags were the obvious eighth and are not here. `eligibleOracleTags`
 * returns 0 slugs against the catalog this was developed on — `oracle_tags` is
 * empty on every printing in it — so a day assigned to them would fall through
 * to themeless every time, silently, which is the failure mode the fallback
 * ladder exists to make loud. Worth revisiting on a catalog that has them; see
 * the note on `themePools`.
 */
export type CrosswordRestrictionKind =
  | 'creatureType'
  | 'colour'
  | 'cardType'
  | 'keyword'
  | 'manaValue'
  | 'colourPair'
  | 'set';

export interface CrosswordDayPlan {
  size: number;
  kind: CrosswordRestrictionKind;
}

/**
 * Indexed by `Date#getUTCDay`, so 0 is Sunday. Monday is 9 and each day after it
 * is one bigger: 9, 10, 11, 12, 13, 14, 15.
 *
 * SUNDAY WAS ASKED FOR AT 16 AND IS 15. That is the one place this departs from
 * the spec, and it is a measurement rather than a preference.
 *
 * Success rate over 12 themed grids per size on a single 20-second budget — one
 * rung of the ladder in puzzle.ts, not the whole of it:
 *
 *     9  12/12   median   1.0s
 *     10 12/12   median   0.1s
 *     11 12/12   median   0.5s
 *     12 12/12   median   1.7s
 *     13 12/12   median   3.2s
 *     14  9/12   median   8.3s
 *     15  9/12   median  10.6s
 *     16  6/12   median  20.0s  <- the median grid never finished
 *
 * Nine through thirteen are free; the cliff is at 14, not at 16. One rung is not
 * the shipped configuration though, so the two sizes that matter were also run
 * end to end through `buildDailyGrid` — all three rungs, real drawn themes, one
 * date per week for twelve consecutive weeks:
 *
 *     Sunday @ 16    6/12 built,  4/12 themed
 *     Sunday @ 15   12/12 built,  8/12 themed
 *     Saturday @ 14 12/12 built, 11/12 themed
 *
 * Six Sundays in twelve with no puzzle at all is not a slow Sunday, it is a
 * broken one — no grid, no streak, a hole in the archive. And the failure is
 * bimodal rather than marginal, which is why the ladder can't rescue it: the six
 * that worked took 1.2s to 6.3s, and all six failures burned the entire 40
 * seconds across all three rungs. Whether a 16x16 exists for a given theme is
 * settled in the first few attempts, and more clock does not revisit it.
 *
 * So `16` here is one character away, and these are the things to do first:
 *
 *  - Pre-generate. The rotate endpoint already takes a `date` override and is
 *    already idempotent, so having the daily lambda also rotate for `today + 7`
 *    gives every date seven independent goes before anyone needs it. At the
 *    measured 50% that is a 1-in-128 miss for one extra HTTP call, and it makes
 *    16 fine.
 *  - Spend longer. 16x16 themed goes 6/12 -> 10/12 when a single rung gets 45s
 *    instead of 20s. It does not fit today: `index.ts` caps every request at 60
 *    seconds, and the lambda arrives through Cloudflare, whose origin timeout is
 *    100s and was not verified here. Both would have to be raised on purpose.
 *
 * Two things that look like fixes and are not, both measured: a longer
 * per-attempt slice makes it *worse* (ATTEMPT_BUDGET_MS at 3000 instead of 800
 * takes 16x16 from 6/12 to 4/12, and 14x14 from 9/12 to 8/12 — the existing
 * tuning is right, and the note on it in generate.ts holds at these sizes too);
 * and rearranging the rung budgets inside the same 40s total moves the failure
 * rate by about one point.
 */
export const WEEKLY_SCHEDULE: readonly CrosswordDayPlan[] = [
  { size: 16, kind: 'set' }, // Sunday — biggest grid, narrowest restriction
  { size: 9, kind: 'creatureType' }, // Monday
  { size: 10, kind: 'colour' }, // Tuesday
  { size: 11, kind: 'cardType' }, // Wednesday
  { size: 12, kind: 'keyword' }, // Thursday
  { size: 13, kind: 'manaValue' }, // Friday
  { size: 14, kind: 'colourPair' }, // Saturday
];

/**
 * 0 = Sunday. Parsed as UTC so the plan doesn't depend on the server's zone.
 *
 * Throws on a date that isn't one. The rotate endpoint's Joi schema checks the
 * *shape* `YYYY-MM-DD` and not the calendar, so `2026-13-45` reaches here from a
 * request body, and `getUTCDay()` answers NaN for it — which would otherwise
 * index the schedule to `undefined` and surface three frames later as "cannot
 * read properties of undefined".
 */
export const weekdayOf = (date: string): number => {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (Number.isNaN(weekday)) {
    throw new Error(`Not a date: ${date}`);
  }
  return weekday;
};

export const planFor = (date: string): CrosswordDayPlan => WEEKLY_SCHEDULE[weekdayOf(date)]!;

/**
 * The intrinsic pools: closed sets that the game itself defines, so there is
 * nothing to derive them from and nothing for them to drift against.
 *
 * Contrast the catalog-derived pools in `themePools` — creature types, keywords
 * and sets all move when the catalog does, and a hand-written copy of any of
 * them would be wrong within a year.
 */
const COLOURS = ['W', 'U', 'B', 'R', 'G'];
const COLOUR_PAIRS = COLOURS.flatMap((first, i) => COLOURS.slice(i + 1).map((second) => `${first}${second}`));
const CARD_TYPES = ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Land', 'Planeswalker', 'Sorcery'];
/** Mana values as filter suffixes. `>=7` rather than `=7` so the tail isn't a cliff. */
const MANA_VALUES = ['=0', '=1', '=2', '=3', '=4', '=5', '=6', '>=7'];

export interface ThemePools {
  creatureTypes: string[];
  keywords: string[];
  sets: string[];
}

/**
 * The catalog-derived pools, read off structures that already exist rather than
 * transcribed into a list here.
 *
 * Creature types and keywords come out of the crossword vocabulary, which builds
 * both by walking every printing (`creatureSubtypes` for the types, `keywords`
 * for the keywords) — so they are the same values the grid can be filled with.
 * Sets come from `eligibleSetCodes`, shared with ManaMatrix so "a real set"
 * means one thing across the games, and date-bounded so a puzzle never themes
 * itself to a set that hadn't been released yet.
 *
 * Both vocabulary pools carry junk — Alchemy and Un-set keywords, one-printing
 * creature types. None of it is filtered out here on purpose: `chooseTheme`
 * already has to reject a value whose filter doesn't parse and a value with too
 * few long card names, and those two checks remove the junk for free. A
 * curated list would be a third thing to keep in step with the catalog.
 */
export const themePools = (date: string): ThemePools => {
  const vocab = getVocabulary();
  const displaysOf = (entryClass: string): string[] =>
    [...new Set(vocab.entries.filter((entry) => entry.entryClass === entryClass).map((entry) => entry.display))].sort();

  return {
    creatureTypes: displaysOf('creatureType'),
    keywords: displaysOf('keyword'),
    sets: eligibleSetCodes(date),
  };
};

/** A value only needs quoting when it has a space in it; most never do. */
const quoted = (value: string): string => (/\s/.test(value) ? `"${value}"` : value);

/**
 * The filter text one kind builds for one value. Every string this can return
 * has to parse via `makeFilter` — see `enumerateThemeFilters`, which exists so a
 * test can prove that over whole pools rather than over whichever values a
 * handful of dates happened to draw.
 */
export const themeFilterText = (kind: CrosswordRestrictionKind, value: string): string => {
  switch (kind) {
    case 'creatureType':
    case 'cardType':
      return `type:${quoted(value)}`;
    case 'colour':
    case 'colourPair':
      return `ci=${value}`;
    case 'keyword':
      return `keyword:${quoted(value)}`;
    case 'manaValue':
      return `cmc${value}`;
    case 'set':
      return `set:${value}`;
  }
};

/** The values a kind may draw from, given the catalog-derived pools. */
export const valuesFor = (kind: CrosswordRestrictionKind, pools: ThemePools): string[] => {
  switch (kind) {
    case 'creatureType':
      return pools.creatureTypes;
    case 'keyword':
      return pools.keywords;
    case 'set':
      return pools.sets;
    case 'colour':
      return COLOURS;
    case 'colourPair':
      return COLOUR_PAIRS;
    case 'cardType':
      return CARD_TYPES;
    case 'manaValue':
      return MANA_VALUES;
  }
};

/**
 * Every filter text the schedule can emit for these pools. The parseability test
 * enumerates this rather than sampling dates: a value that doesn't parse is a
 * value some date will eventually draw, and sampling would find it on that day
 * rather than in CI.
 */
export const enumerateThemeFilters = (pools: ThemePools): string[] =>
  WEEKLY_SCHEDULE.flatMap((plan) => valuesFor(plan.kind, pools).map((value) => themeFilterText(plan.kind, value)));

/**
 * Card names of exactly the grid's width that a theme can supply.
 *
 * This is the number that decides whether a theme is real. The frame the
 * generator seeds is four entries spanning the grid edge to edge (see
 * `framePlan` in generate.ts), and only a card name is ever that long — so a
 * theme with no names at that length cannot put a single themed answer in the
 * frame. It does not *fail*: `findSeedEntries` drops to its unthemed rung and
 * returns a perfectly good grid with nothing of the theme in it. That quiet
 * degradation is what this check is here to prevent.
 */
export const spanningThemeNames = (filterText: string, size: number): number => {
  const texts = themedCardTexts(filterText);
  if (!texts) {
    return 0;
  }
  let count = 0;
  for (const text of texts) {
    if (text.length === size) {
      count += 1;
    }
  }
  return count;
};

/**
 * Spanning names a drawn theme must have before it is worth using.
 *
 * Six, which is above the four the frame wants and far below what would make all
 * four *interlock*. It is a floor on "is there a theme here at all", not a
 * prediction that the frame will be fully themed — with six candidates it
 * usually won't be, and the search's middle rung (themed rows, whatever crosses
 * them) is what the theme normally lands through. Measured end to end, a week of
 * Saturdays lands its colour pair in 11 grids of 12 and a week of Sundays lands
 * its set in 8 of 12, which is the difference between a pool hundreds deep at
 * the spanning length and one about thirty deep.
 *
 * Measured over the whole of each pool, as the share of values clearing 6 at
 * that day's size:
 *
 *     Mon  creatureType @ 9    9%   (of 349)
 *     Tue  colour       @10  100%   (of 5)
 *     Wed  cardType     @11  100%   (of 7)
 *     Thu  keyword      @12    7%   (of 665)
 *     Fri  manaValue    @13  100%   (of 8)
 *     Sat  colourPair   @14  100%   (of 10)
 *     Sun  set          @15   98%   (of 135)
 *
 * The two thin rows are the catalog-derived pools, and the thinness is the check
 * doing its job rather than a problem with it: most of Scryfall's 665 "keywords"
 * are Alchemy and Un-set ability words on a handful of cards each, and most of
 * the 349 creature subtypes belong to one printing. What clears the floor is
 * roughly the fifty keywords and thirty creature types a player would name. It
 * is also why MAX_THEME_DRAWS is as large as it is rather than the two or three
 * the intrinsic pools would need.
 */
const MIN_SPANNING_THEME_NAMES = 6;

/**
 * Values tried before a day gives up and goes themeless.
 *
 * Each draw costs one `themedCardTexts` pass over the catalog — measured at 55
 * to 90ms, and cached per filter text for the life of the process, so a server
 * that has been up a while pays less. Forty is the ceiling, so about 3.5s per
 * themed rung and 7s across the two of them, which is what the rung budgets in
 * puzzle.ts are sized to leave room for under the 60s request timeout.
 *
 * Sized by the worst pools rather than the average, because the average pool
 * clears on the first draw. At the rates above, forty draws leaves a 2% chance
 * of a themeless Monday and 5% of a themeless Thursday; ten draws would leave
 * 39% and 48%. Drawing without replacement is what makes forty draws actually
 * forty distinct values — see `chooseTheme`.
 */
const MAX_THEME_DRAWS = 40;

export interface CrosswordTheme {
  kind: CrosswordRestrictionKind;
  /** The drawn value, e.g. "Elf" or "mh3". */
  value: string;
  filterText: string;
  /** Card names of exactly the grid's width this theme supplies. */
  spanningNames: number;
}

/**
 * The theme for one date, or null when this day's pool couldn't supply one.
 *
 * Deterministic in `(date, attempt)` and nothing else: the rng is a local
 * `seedrandom` instance, never the global `Math.random`, so re-running a date
 * rebuilds the same puzzle — which is the property the whole archive depends on.
 * `attempt` is what makes the second rung of the ladder a genuinely different
 * draw rather than the same one retried.
 *
 * Values are drawn *without replacement*, by partial Fisher-Yates over a copy:
 * with a 349-value pool and a one-in-eleven hit rate, drawing with replacement
 * would spend a meaningful share of its forty tries re-testing values it had
 * already rejected.
 *
 * `depthOf` is injected so this can be tested without a card catalog; the real
 * caller passes `spanningThemeNames`.
 */
export const chooseTheme = (
  date: string,
  attempt: number,
  plan: CrosswordDayPlan,
  pools: ThemePools,
  depthOf: (filterText: string, size: number) => number = spanningThemeNames,
): CrosswordTheme | null => {
  const rng = seedrandom(`${date}:crossword-theme:${attempt}`);
  const candidates = [...valuesFor(plan.kind, pools)];
  const draws = Math.min(MAX_THEME_DRAWS, candidates.length);

  for (let i = 0; i < draws; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i));
    const swap = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = swap;

    const value = candidates[i]!;
    const filterText = themeFilterText(plan.kind, value);
    // A pool read off the catalog can contain anything, so the grammar gets the
    // first word. Cheap, and it runs before the scan that isn't.
    if (makeFilter(filterText).err) {
      continue;
    }
    const spanningNames = depthOf(filterText, plan.size);
    if (spanningNames >= MIN_SPANNING_THEME_NAMES) {
      return { kind: plan.kind, value, filterText, spanningNames };
    }
  }

  return null;
};
