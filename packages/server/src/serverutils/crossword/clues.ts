import { normalizeName } from '@utils/cardutil';
import Card, { CardDetails } from '@utils/datatypes/Card';
import { CrosswordEntryClass, CrosswordVocabEntry } from '@utils/datatypes/Crossword';
import { makeFilter } from '@utils/filtering/FilterCards';
import { describeFilterTerms } from 'serverutils/filterDescription';
import { clearTagCountsCache, eligibleOracleTagCounts, MIN_RECOGNISABLE_TAG_NAMES } from 'serverutils/tagEligibility';

import { CROSSWORD_SYNONYMS } from './synonyms.generated';
import { creatureSubtypes, nameTokens, normalize, oracleWords, originalPrintings, splitNameParts } from './vocabulary';

/**
 * Clue text for crossword entries. Clues are built per puzzle and never stored,
 * so everything here is a pure function of a vocabulary entry, a seeded rng and
 * the catalog-derived `ClueContext`. Nothing in this file may call Math.random:
 * a seed has to reproduce its clues along with its grid.
 *
 * Two rules hold for every class:
 *
 * - A clue never contains its own answer, in any form the solver could read it
 *   back out of — not spelled, not as the initials of consecutive words. See
 *   `revealsEntry`.
 * - A clue never states how many cards match it. The narrowing filter counts
 *   matches to decide when it is specific enough, but the count is a tell about
 *   how pinned-down the answer is and stays internal.
 */

/** What the solver fills in. Four underscores read as a blank at any font size. */
const BLANK = '____';

/**
 * Card names remembered per creature type / keyword / rules word / set. Clues
 * pick from the pool with the puzzle's rng, so a pool is what makes successive
 * puzzles vary; eight is plenty of variety for a bounded index.
 */
const CLUE_SOURCES_PER_KEY = 8;

/**
 * Match count a narrowing filter aims to get under. Above this the filter hasn't
 * really identified a card, so another attribute goes on — but a filter that runs
 * out of attributes still ships. The count never reaches the solver; it is only
 * how the builder knows when to stop.
 */
const CARD_NAME_TARGET_MATCHES = 25;

/** Mirrors the vocabulary's length window, so we never index unusable words. */
const MIN_LENGTH = 3;
const MAX_LENGTH = 21;

/** Rarities `r:` understands. Anything else (e.g. "bonus") is not a filter term. */
const FILTERABLE_RARITIES = new Set(['common', 'uncommon', 'rare', 'mythic', 'special']);

/**
 * How many oracle-tag terms one filter may carry.
 *
 * Tags are the most interesting thing the catalog knows about a card — they say
 * what it *does*, which colour and mana value never will — but a clue that is
 * nothing but tags reads as a list rather than a description, and Tagger's
 * families of near-synonyms (removal / removal-creature / spot-removal) make
 * that worse. Two leaves room for the colour, type and cost terms that give a
 * clue its shape.
 */
const MAX_TAG_TERMS = 2;

/** Scryfall slugs are lowercase words joined by hyphens; anything else isn't one. */
const TAG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Reads as a noun in "5-letter ___", for the clue of last resort. */
const CLASS_NOUN: Record<CrosswordEntryClass, string> = {
  cardName: 'card name',
  nameWord: 'word from a card name',
  nameBigram: 'pair of adjacent words from a card name',
  acronym: "card name's initials",
  creatureType: 'creature type',
  keyword: 'keyword ability',
  legendName: "legend's name",
  legendTitle: "legend's title",
  setCode: 'set code',
  oracleWord: 'word from Magic rules text',
};

/**
 * The four classes whose answer is some part of one card, clued by describing a
 * filter that narrows to it, plus the suffix saying which part is wanted.
 *
 * They share one code path because they are one clue shape. Before this they were
 * three formats that named the card outright — "Jace, the Mind Sculptor, abbrev."
 * for JACE, "Richard Garfield, Ph.D., title" for PHD, '"Thrun, the Last Troll",
 * as an acronym' for TTLT — each of which hands the solver the answer, the last
 * one by simple first-letter extraction.
 */
const FILTER_CLUE_SUFFIX: Partial<Record<CrosswordEntryClass, string>> = {
  cardName: '',
  legendName: ', abbrev.',
  legendTitle: ', title',
  acronym: ', as an acronym',
};

/**
 * What a slot's clue consists of: the sentence the solver reads, and — for the
 * filter-based classes — the filter it is a translation of, so a caller can show
 * the Scryfall syntax beside the English or not at all.
 */
export interface CrosswordClue {
  clue: string;
  clueFilter?: string;
}

/**
 * A card name with every occurrence of `text` blanked out:
 * ("Jace, the Mind Sculptor", "MIND") -> "Jace, the ____ Sculptor".
 *
 * The words are the same words the vocabulary pass counted — `splitNameParts`
 * is shared with it — so anything that became an entry can be blanked back out
 * of its sources. Matching is on the normalized word because that is what the
 * grid holds ("Jace's" is JACES, "Never-Ending" is NEVERENDING), while every
 * word that isn't blanked is emitted exactly as printed, punctuation and all.
 *
 * Returns null when no word matched, which means the caller paired an entry with
 * a card it doesn't appear in.
 */
export const blankNameWord = (cardName: string, text: string): string | null => {
  const target = normalize(text);
  if (!target) {
    return null;
  }

  let matched = false;
  const parts = splitNameParts(cardName).map((part, index) => {
    // Odd indices are the separators between words, and are never blanked.
    if (index % 2 !== 0 || normalize(part) !== target) {
      return part;
    }
    matched = true;
    return BLANK;
  });

  return matched ? parts.join('') : null;
};

/**
 * A card name with an adjacent pair of words blanked out, one blank each:
 * ("Jace, the Mind Sculptor", "MINDSCULPTOR") -> "Jace, the ____ ____".
 *
 * Two blanks rather than one, because the answer is two words and the solver has
 * to know that. The pair is matched the way the vocabulary built it — adjacent,
 * in order, never across the `//` of a split card — so anything that became a
 * nameBigram can be blanked back out of its sources. Returns null when no pair
 * matched.
 */
export const blankNameBigram = (cardName: string, text: string): string | null => {
  const target = normalize(text);
  if (!target) {
    return null;
  }
  const parts = splitNameParts(cardName);
  // Found first, replaced after: a blank is itself punctuation-only, so blanking
  // as we go could let one substitution create a spurious match for the next.
  const starts: number[] = [];
  for (let index = 0; index + 2 < parts.length; index += 2) {
    const first = parts[index]!;
    const second = parts[index + 2]!;
    if (!first || !second || parts[index + 1]!.includes('/')) {
      continue;
    }
    if (normalize(`${first}${second}`) === target) {
      starts.push(index);
    }
  }
  if (starts.length === 0) {
    return null;
  }
  for (const start of starts) {
    parts[start] = BLANK;
    parts[start + 2] = BLANK;
  }
  return parts.join('');
};

/** Where an rng lands in a list, matching `nameWordClue`'s long-standing pick. */
const startIndex = (length: number, rng: () => number): number =>
  length === 0 ? 0 : Math.min(length - 1, Math.floor(rng() * length));

/** A list rotated to a seeded starting point, so iteration order varies per puzzle. */
const rotated = <T>(items: T[], rng: () => number): T[] => {
  const start = startIndex(items.length, rng);
  return items.map((_, offset) => items[(start + offset) % items.length]!);
};

/**
 * A fill-in-the-blank clue for a name word, citing one of the entry's cards.
 *
 * The card is picked with the puzzle's seeded rng so the same puzzle always
 * shows the same clue while successive puzzles vary. A source that can't be
 * blanked is skipped rather than fatal; null means none of them worked.
 */
export const nameWordClue = (
  entry: CrosswordVocabEntry,
  rng: () => number,
  blank: (cardName: string, text: string) => string | null = blankNameWord,
): string | null => {
  const sources = entry.sourceCardNames ?? (entry.sourceCardName ? [entry.sourceCardName] : []);
  if (sources.length === 0) {
    return null;
  }

  for (const source of rotated(sources, rng)) {
    const clue = blank(source, entry.text);
    if (clue) {
      return clue;
    }
  }
  return null;
};

/**
 * Catalog-derived indexes the clue writers need: which cards carry a creature
 * type, a keyword, a rules word, or their premiere in a set, plus the attributes
 * a card-name filter is built from.
 *
 * One entry per distinct card name, and specifically that name's *original*
 * printing (see `isEarlierPrinting`), so "first printed in this set" is true and
 * a rarity in a filter is the rarity the card debuted at. A match count is then a
 * count of answers rather than of printings.
 */
export interface ClueContext {
  cards: CardDetails[];
  byNameLower: Map<string, number>;
  byCreatureType: Map<string, number[]>;
  byKeyword: Map<string, number[]>;
  /** Cards whose rules text uses the word, at a position `oracleWords` can state. */
  byOracleWord: Map<string, number[]>;
  bySetCode: Map<string, number[]>;
  /**
   * Scryfall Tagger oracle tags a clue may name, with how many distinct cards
   * carry each. Membership is the recognisability test — the same one ManaMatrix
   * picks its tag categories with, see `serverutils/tagEligibility` — and the
   * count ranks one card's tags against each other in `tagTerms`.
   */
  oracleTagCounts: Map<string, number>;
}

const pushCapped = (map: Map<string, number[]>, key: string, index: number): void => {
  const bucket = map.get(key);
  if (!bucket) {
    map.set(key, [index]);
  } else if (bucket.length < CLUE_SOURCES_PER_KEY) {
    bucket.push(index);
  }
};

let cachedContext: ClueContext | undefined;

const buildClueContext = (): ClueContext => {
  // The original printing of every distinct name, from the same helper the
  // vocabulary pass uses, so the two agree on which card a word was counted on.
  const bestByName = originalPrintings();

  const cards: CardDetails[] = [];
  const byNameLower = new Map<string, number>();
  const byCreatureType = new Map<string, number[]>();
  const byKeyword = new Map<string, number[]>();
  const byOracleWord = new Map<string, number[]>();
  const bySetCode = new Map<string, number[]>();

  for (const [nameLower, details] of bestByName) {
    const index = cards.length;
    cards.push(details);
    byNameLower.set(nameLower, index);

    for (const subtype of creatureSubtypes(details.type)) {
      pushCapped(byCreatureType, normalize(subtype), index);
    }
    for (const keyword of details.keywords ?? []) {
      pushCapped(byKeyword, normalize(keyword), index);
    }
    if (details.set) {
      pushCapped(bySetCode, details.set.toLowerCase(), index);
    }

    // The same tokenizer the vocabulary counted words with, so every oracleWord
    // entry has a card here and every position this index implies is one a reader
    // would count. There used to be a second index for words that only exist
    // inside a longer one — AREN, NON, SIDED — and it is gone because the shared
    // tokenizer no longer mints them.
    for (const word of new Set(oracleWords(details.oracle_text ?? ''))) {
      if (word.length >= MIN_LENGTH && word.length <= MAX_LENGTH) {
        pushCapped(byOracleWord, word, index);
      }
    }
  }

  return {
    cards,
    byNameLower,
    byCreatureType,
    byKeyword,
    byOracleWord,
    bySetCode,
    oracleTagCounts: eligibleOracleTagCounts(MIN_RECOGNISABLE_TAG_NAMES),
  };
};

export const getClueContext = (): ClueContext => {
  if (!cachedContext) {
    const start = Date.now();
    cachedContext = buildClueContext();
    console.info(
      `Crossword clue context built in ${Date.now() - start}ms: ${cachedContext.cards.length} named cards, ` +
        `${cachedContext.byOracleWord.size} rules words, ${cachedContext.byCreatureType.size} creature types, ` +
        `${cachedContext.bySetCode.size} sets with a premiere, ` +
        `${cachedContext.oracleTagCounts.size} recognisable oracle tags`,
    );
  }
  return cachedContext;
};

/**
 * Test seam: drop the cache so a rebuilt catalog is re-scanned. The tag counts
 * are dropped with it — the context embeds them, so leaving them cached would
 * describe the previous catalog.
 */
export const clearClueContextCache = (): void => {
  cachedContext = undefined;
  clearTagCountsCache();
};

/**
 * Whether citing this card would hand over the answer, e.g. "a type of Fear"
 * for the keyword FEAR. The whole name and each of its words are checked, since
 * "Elf Warrior" would give away ELF as surely as a card named "Elf" would.
 */
const revealsAnswer = (cardName: string, text: string): boolean =>
  normalize(cardName) === text || nameTokens(cardName).some((token) => normalize(token) === text);

/** The pool with give-aways dropped — unless that empties it, in which case take what there is. */
const usableSources = (indices: number[], text: string, ctx: ClueContext): number[] => {
  const clean = indices.filter((index) => !revealsAnswer(ctx.cards[index]!.name, text));
  return clean.length > 0 ? clean : indices;
};

/**
 * Card names are cited inside a sentence, and a third of legends have a comma of
 * their own, so those get quoted: "a type of "Greasefang, Okiba Boss"" rather than
 * a clue that reads as two clues.
 */
const citedName = (name: string): string => (name.includes(',') ? `"${name}"` : name);

/** One card name from a pool, chosen with the puzzle's rng, ready to cite. */
const pickCardName = (indices: number[], text: string, ctx: ClueContext, rng: () => number): string | null => {
  const pool = usableSources(indices, text, ctx);
  if (pool.length === 0) {
    return null;
  }
  return citedName(ctx.cards[pool[startIndex(pool.length, rng)]!]!.name);
};

/** A filter value, quoted when it isn't a bare alphanumeric word the grammar accepts. */
const filterValue = (value: string): string =>
  /^[A-Za-z0-9]+$/.test(value) ? value.toLowerCase() : `"${value.replace(/["\\]/g, '').toLowerCase()}"`;

/** `ci=` value for a colour identity; the empty identity is colourless, `ci=c`. */
const colorIdentityValue = (identity: string[]): string => {
  const letters = 'WUBRG'
    .split('')
    .filter((color) => identity.includes(color) || identity.includes(color.toLowerCase()));
  return letters.length === 0 ? 'c' : letters.join('').toLowerCase();
};

/** Words of a type line either side of the em dash, letters only, deduplicated. */
const typeWords = (typeLine: string): { types: string[]; subtypes: string[] } => {
  const dash = typeLine.indexOf('—');
  const cut = (part: string): string[] => [
    ...new Set(part.split(/\s+/).filter((word) => /[A-Za-z]/.test(word) && !word.includes('//'))),
  ];
  return dash < 0
    ? { types: cut(typeLine), subtypes: [] }
    : { types: cut(typeLine.slice(0, dash)), subtypes: cut(typeLine.slice(dash + 1)) };
};

/**
 * Whether any run of consecutive words in a hyphenated slug spells one of
 * `forbidden`: "reanimate-creature" spells REANIMATE, "tutor-land-to-battlefield"
 * spells TUTORLAND.
 *
 * Runs rather than whole words only, for the same reason `revealsEntry` reads
 * runs: the grid holds letters, so two words of a clue sitting next to each
 * other are as readable as one.
 */
const spellsForbidden = (slug: string, forbidden: Set<string>): boolean => {
  const words = slug.split('-').map(normalize).filter(Boolean);
  for (let start = 0; start < words.length; start++) {
    let run = '';
    for (let end = start; end < words.length; end++) {
      run += words[end]!;
      if (forbidden.has(run)) {
        return true;
      }
    }
  }
  return false;
};

/**
 * The card's oracle tags worth naming, as filter terms, most telling first.
 *
 * Tagger's slugs are the only thing in the catalog that says what a card *does*
 * — "removal", "ramp", "tutor", "sacrifice-outlet" — so they are the best clue
 * material available, but only the ones a player would recognise: the full
 * dictionary runs to thousands and its tail is curation bookkeeping. Eligibility
 * is `serverutils/tagEligibility`'s, shared with ManaMatrix's tag categories so
 * the two can't drift apart on what a real tag is.
 *
 * Among a card's eligible tags the rarest goes first. They have all cleared the
 * recognisability floor already, so the one on fewest cards is the one that
 * actually distinguishes this card — and it narrows the filter fastest, which is
 * the same thing the term order is for.
 *
 * At most one tag per family, where a family is the slug's first word: a card
 * tagged `removal`, `removal-creature` and `removal-destroy` has said "removal"
 * once, and spending both tag slots on it wastes the clue.
 *
 * The value is always quoted, because a quoted tag value is an exact match while
 * a bare one is a substring match (see `tagSetElementOpValue`) — and the English
 * this renders as, 'oracle tag is "removal"', is a claim of exactness.
 *
 * A slug whose words spell something `forbidden` is skipped and the next tag
 * used instead. The hyphens are why this can't be left to the whole-value check
 * in `narrowingFilter`: "reanimate-creature" is not the answer REANIMATE as one
 * string, but a solver reads it as two words and the first one is the answer.
 */
/**
 * Tags that describe a card's *data* rather than what it does — its printing
 * history, its name, its templating. Scryfall Tagger tracks these for curation
 * and they clue nothing: "punny-name" says nothing about the card, and
 * "single-english-word-name" quietly tells the solver the answer's shape.
 *
 * Deliberately local to the crossword rather than added to the blocklist in
 * `serverutils/tagEligibility.ts`, which ManaMatrix shares — widening that one
 * would silently move ManaMatrix's daily categories to fix a crossword clue.
 */
const UNCLUEABLE_TAG_SLUGS = new Set([
  'aesthetic-counter',
  'alliteration',
  'card-names',
  'cycle',
  'deprecated-card-types',
  'deprecated-mechanics',
  'french-vanilla',
  'mix-and-match',
  'name-matters',
  'namesake-spell',
  'punny-name',
  'single-english-word-name',
  'type-addition-from-none',
  'type-errata',
  'vanilla',
]);

const tagTerms = (details: CardDetails, ctx: ClueContext, forbidden: Set<string>): string[] => {
  const eligible = (details.oracle_tags ?? [])
    .filter(
      (slug) =>
        TAG_SLUG.test(slug) &&
        ctx.oracleTagCounts.has(slug) &&
        !UNCLUEABLE_TAG_SLUGS.has(slug) &&
        !spellsForbidden(slug, forbidden),
    )
    // Ties broken by slug, so the term order never depends on catalog order.
    .sort((a, b) => ctx.oracleTagCounts.get(a)! - ctx.oracleTagCounts.get(b)! || a.localeCompare(b));

  const terms: string[] = [];
  const families = new Set<string>();
  for (const slug of eligible) {
    if (terms.length >= MAX_TAG_TERMS) {
      break;
    }
    const family = slug.split('-')[0]!;
    if (families.has(family)) {
      continue;
    }
    families.add(family);
    terms.push(`otag:"${slug}"`);
  }
  return terms;
};

/**
 * Filter terms for a card, most characteristic first.
 *
 * Colour identity and the creature's own subtype are what a solver recognises a
 * card by, so they lead; mana value is the cheapest big cut after that. The tail
 * — power/toughness, rarity, first-printed year, set — only gets used by cards
 * whose front half doesn't narrow enough, which in practice means vanilla spells.
 *
 * The list is walked in order and stops as soon as the filter is narrow enough,
 * so a term's position is the whole of its priority: anything near the end is
 * never reached. That is why the set code had to move up, and why oracle tags go
 * near the front rather than being appended.
 */
const filterTerms = (details: CardDetails, ctx: ClueContext, forbidden: Set<string>): string[] => {
  const { types, subtypes } = typeWords(details.type);
  const terms = [`ci=${colorIdentityValue(details.color_identity ?? [])}`];

  // A planeswalker's subtype is a character's name, so it is never a fair clue
  // term. Usually it repeats the card's own name and the name-word guard drops
  // it — but on a Universes Beyond reskin the two come apart: "Meiko, ..." keeps
  // the type line "Planeswalker — Chandra", nothing in the name matches, and the
  // clue ends up describing a character who isn't the answer. Dropping the
  // subtype costs these cards some precision and stops them lying.
  if (!types.some((type) => type.toLowerCase() === 'planeswalker')) {
    for (const subtype of subtypes) {
      terms.push(`t:${filterValue(subtype)}`);
    }
  }
  // What the card does, ahead of its keywords and its stats — a clue saying
  // Keywords first: an evergreen keyword is something every player knows, where
  // most tags are Tagger vocabulary. Putting tags ahead of these collapsed
  // keyword usage by 88% and cost Serra Angel "flying, vigilance" in exchange
  // for "french-vanilla, namesake-spell" — a plainly worse clue.
  for (const keyword of details.keywords ?? []) {
    if (/^[A-Za-z][A-Za-z' -]*$/.test(keyword)) {
      terms.push(`keyword:${filterValue(keyword)}`);
    }
  }
  // "oracle tag is "counterspell"" describes a card the way a player would,
  // where "color identity is exactly Blue, mana value is 2" describes a
  // spreadsheet row. Most instants and sorceries have no keywords at all, so
  // without these they had nothing between colour and cost. (Printed mana cost
  // would belong around here too, but CardDetails has no mana_cost field — it
  // needs the parsed-cost representation and is left for a follow-up.)
  terms.push(...tagTerms(details, ctx, forbidden));
  if (Number.isInteger(details.cmc)) {
    terms.push(`mv=${details.cmc}`);
  }
  for (const type of types) {
    terms.push(`t:${filterValue(type)}`);
  }
  // Where it premiered is more interesting than its stat line, so it comes
  // before them rather than last where it was never reached.
  if (details.set && /^[A-Za-z0-9]+$/.test(details.set)) {
    terms.push(`s:${details.set.toLowerCase()}`);
  }
  if (details.power && /^\d+$/.test(details.power)) {
    terms.push(`pow=${details.power}`);
  }
  if (details.toughness && /^\d+$/.test(details.toughness)) {
    terms.push(`tou=${details.toughness}`);
  }
  if (details.rarity && FILTERABLE_RARITIES.has(details.rarity.toLowerCase())) {
    terms.push(`r:${details.rarity.toLowerCase()}`);
  }
  if (Number.isInteger(details.firstPrintYear)) {
    terms.push(`fy=${details.firstPrintYear}`);
  }
  return terms;
};

/** The value side of a term: `t:"human wizard"` -> HUMANWIZARD, `mv=1` -> ''. */
const termValueText = (term: string): string => {
  const operator = term.search(/[:=<>!]/);
  return operator < 0 ? '' : normalize(term.slice(operator).replace(/^[:=<>!]+/, ''));
};

/**
 * The terms of a Scryfall-style filter that narrows to one card: `ci=g t:elf mv=1`.
 *
 * Terms go on one at a time and each prefix is put through `makeFilter` and run
 * for real, so a clue can never be built on a filter that doesn't parse, matches
 * nothing, or — the subtler failure — excludes the very card it is cluing. The
 * count that decides when to stop comes from narrowing the previous match set
 * rather than rescanning the catalog, which is the same answer because
 * space-separated terms are an AND. It never leaves this function: a solver told
 * how many cards match has been told how pinned-down the answer is.
 *
 * A term that doesn't shrink the match set is dropped even though it is true:
 * "t:creature" after "t:beast" makes the clue longer and no more answerable.
 *
 * A term repeating a word of the card's own name is dropped too, however well it
 * narrows: `t:jace` on "Jace, the Mind Sculptor" reads as "type line includes
 * Jace", which is the answer to the legendName clue and half of the cardName one.
 * `entryText` is in the same set, for the classes whose answer is not a word of
 * the name: the oracle tag `counterspell` spells the cardName answer for
 * Counterspell, and `mirror-breaker` would spell a legendTitle.
 */
const narrowingFilter = (details: CardDetails, ctx: ClueContext, entryText: string): string[] | null => {
  // Letterless tokens — the "40,000" of "Warhammer 40,000" — normalize to nothing,
  // and so does the value of `mv=3`. Dropping them keeps a number from matching a
  // number and taking a good term out of every clue for the card.
  const forbidden = new Set(
    [normalize(details.name), ...nameTokens(details.name).map(normalize), entryText].filter(Boolean),
  );
  const accepted: string[] = [];
  let matches = ctx.cards;

  for (const term of filterTerms(details, ctx, forbidden)) {
    const value = termValueText(term);
    if (value && forbidden.has(value)) {
      continue;
    }
    const attempt = [...accepted, term];
    const { err, filter } = makeFilter(attempt.join(' '));
    if (err || !filter) {
      continue;
    }
    const narrowed = matches.filter((candidate) => filter({ details: candidate } as Card));
    if (narrowed.length >= matches.length) {
      continue;
    }
    // A term that drops the card itself is describing something else.
    if (!narrowed.some((candidate) => candidate.name_lower === details.name_lower)) {
      continue;
    }
    accepted.length = 0;
    accepted.push(...attempt);
    matches = narrowed;
    if (matches.length < CARD_NAME_TARGET_MATCHES) {
      break;
    }
  }

  return accepted.length === 0 ? null : accepted;
};

/** Consecutive words of a clue, letters only: used to read an answer back out of it. */
const clueWords = (text: string): string[] => text.split(/\s+/).map(normalize).filter(Boolean);

/**
 * Whether a solver could read the answer straight off this clue.
 *
 * Two ways that happens, and both are checked over every run of consecutive
 * words rather than over the whole string, because a substring test on letters
 * alone fires on accidents ("with" contains ITH, the legend Ith):
 *
 * - the words spell the answer — MINDSCULPTOR out of "... Mind Sculptor ...";
 * - their initials spell it, which is how an acronym clue leaks: TTLT out of any
 *   four consecutive words starting T, T, L, T.
 *
 * The card's own name is checked as well as the entry text, since naming the card
 * gives away every class derived from it.
 */
const revealsEntry = (text: string, entry: CrosswordVocabEntry): boolean => {
  const words = clueWords(text);
  const spelled = new Set([entry.text, normalize(entry.sourceCardName ?? entry.display)].filter(Boolean));
  const longest = Math.max(...[...spelled].map((target) => target.length));
  for (let start = 0; start < words.length; start++) {
    let run = '';
    let initials = '';
    for (let end = start; end < words.length; end++) {
      run += words[end]!;
      initials += words[end]![0]!;
      if (spelled.has(run) || initials === entry.text) {
        return true;
      }
      // Both only grow from here, so once each is past its target the window is
      // spent and the next start is the only thing left to try.
      if (run.length >= longest && initials.length >= entry.text.length) {
        break;
      }
    }
  }
  return false;
};

/**
 * The clue for an answer that is part of one card: a plain-English reading of a
 * filter that narrows to it, plus the suffix for which part is wanted.
 *
 * "color identity is exactly Blue, mana value is 4, type line includes
 * Planeswalker, abbrev." — which asks for JACE without printing it, where the
 * specified format ("Jace, the Mind Sculptor, abbrev.") answered itself.
 *
 * Returns null, and so falls through to the clue of last resort, when the card
 * isn't in the context or when everything available would give the answer away.
 */
const filterClue = (entry: CrosswordVocabEntry, ctx: ClueContext, suffix: string): CrosswordClue | null => {
  const name = entry.sourceCardName ?? entry.display;
  // `normalizeName`, not toLowerCase: `name_lower` is accent-folded, so a plain
  // lowercase of "Gríma, Saruman's Footman" misses the card and every clue for
  // every entry off an accented name comes out generic.
  const index = ctx.byNameLower.get(normalizeName(name));
  if (index === undefined) {
    return null;
  }
  const details = ctx.cards[index]!;
  const terms = narrowingFilter(details, ctx, entry.text);
  if (terms) {
    const described = `${describeFilterTerms(terms)}${suffix}`;
    if (!revealsEntry(described, entry)) {
      return { clue: described, clueFilter: terms.join(' ') };
    }
  }
  // Nothing about the card narrowed, or what did would have leaked the answer.
  // The type line still describes the card without naming it, which is a clue,
  // just not a filter. (If that leaks too, `clueFor`'s guard catches it.)
  const fallback = Number.isInteger(details.cmc) ? `${details.type}, mana value ${details.cmc}` : details.type;
  return fallback ? { clue: `${fallback}${suffix}` } : null;
};

const setCodeClue = (entry: CrosswordVocabEntry, ctx: ClueContext, rng: () => number): string | null => {
  // A set nobody premiered in can't be clued by a first printing.
  if (entry.reprintOnly) {
    return entry.setReleasedAt ? `reprint-only set released on ${entry.setReleasedAt}` : 'a reprint-only set';
  }
  const code = (entry.setCode ?? '').toLowerCase();
  const name = code ? pickCardName(ctx.bySetCode.get(code) ?? [], entry.text, ctx, rng) : null;
  if (name) {
    return `${name} was first printed in this set`;
  }
  return entry.setReleasedAt ? `set released on ${entry.setReleasedAt}` : null;
};

/**
 * a synonym pair, or failing that the word blanked out of real rules text.
 *
 * Rules words used to be clued by position — "32nd word on Sword of Body and
 * Mind" — which is a counting exercise rather than a puzzle. Nobody counts to
 * 32, so that form is gone entirely rather than kept as a last resort.
 *
 * Synonyms come from a baked Datamuse map (see scripts/bake-crossword-synonyms.ts);
 * roughly half the vocabulary has no usable one, because Magic's rules text is
 * dense with function words and jargon a thesaurus either can't help with or
 * actively misleads on. Those fall through to the blank, where the surrounding
 * text supplies the meaning instead.
 */
const synonymClue = (entry: CrosswordVocabEntry, rng: () => number): string | null => {
  const synonyms = CROSSWORD_SYNONYMS[entry.text];
  if (!synonyms || synonyms.length === 0) {
    return null;
  }
  const picked = rotated([...synonyms.keys()], rng)
    .slice(0, 2)
    .map((index) => synonyms[index]!);
  const joined = picked.join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
};

/** Reminder text is parenthesised rules restatement — it would give the game away. */
const stripReminders = (text: string): string => text.replace(/\([^)]*\)/g, ' ');

/**
 * The card's own name, blanked out of its rules text — except where a name word
 * IS the answer. "Searing Blaze" says "Searing" in its text, and blanking that
 * along with the name left SEARING with nothing to be clued from; 37 rules words
 * were unclueable for exactly this reason.
 */
const anonymiseCardName = (text: string, cardName: string, answer: string): string => {
  let out = text.split(cardName).join('~');
  splitNameParts(cardName).forEach((part, index) => {
    if (index % 2 !== 0 || part.length < 3 || normalize(part) === answer) {
      return;
    }
    out = out.split(part).join('~');
  });
  return out;
};

/** Long enough for most Magic sentences, short enough to still read as a clue. */
const MAX_BLANK_CLUE_LENGTH = 200;

/** Words kept either side of the answer when a sentence is too long to quote whole. */
const EXCERPT_WORDS_EACH_SIDE = 6;

/**
 * A window of a sentence around the answer, elided at whichever end was cut.
 *
 * A clue doesn't have to be a whole sentence. Magic's longer rules text runs
 * well past what reads as a clue, and discarding those cards outright left 32
 * rules words with no clue at all.
 */
const excerptAround = (sentence: string, answer: string): string | null => {
  const parts = splitNameParts(sentence);
  const target = parts.findIndex((part, index) => index % 2 === 0 && normalize(part) === answer);
  if (target < 0) {
    return null;
  }
  // Parts alternate word/separator, so a word's neighbours are two apart.
  const first = Math.max(0, target - EXCERPT_WORDS_EACH_SIDE * 2);
  const last = Math.min(parts.length - 1, target + EXCERPT_WORDS_EACH_SIDE * 2);
  const body = parts
    .slice(first, last + 1)
    .join('')
    .trim();
  if (!body) {
    return null;
  }
  return `${first > 0 ? '…' : ''}${body}${last < parts.length - 1 ? '…' : ''}`;
};

const blankInRulesText = (entry: CrosswordVocabEntry, ctx: ClueContext, rng: () => number): string | null => {
  // Every source, not `usableSources`: that filter exists to stop a clue naming
  // a card whose name gives the answer away, and here the name is removed.
  for (const index of rotated(ctx.byOracleWord.get(entry.text) ?? [], rng)) {
    const details = ctx.cards[index]!;
    const anonymised = anonymiseCardName(stripReminders(details.oracle_text ?? ''), details.name, entry.text);

    // Shortest sentence that actually contains the word — long ones read as a
    // wall of rules rather than a clue.
    const sentence = anonymised
      .split(/(?<=[.!?])\s+|\n+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && oracleWords(part).includes(entry.text))
      .sort((a, b) => a.length - b.length)[0];
    if (!sentence) {
      continue;
    }
    const quoted = sentence.length > MAX_BLANK_CLUE_LENGTH ? excerptAround(sentence, entry.text) : sentence;
    if (!quoted) {
      continue;
    }

    // Blank on normalized words, not a raw regex. The grid holds YOURE while
    // the card prints "you're", and \bYOURE\b can never match that — which is
    // why every folded contraction came out unclueable. Punctuation around the
    // word is kept so the sentence still reads: "creature." -> "____."
    let matched = false;
    const blanked = splitNameParts(quoted)
      .map((part, index) => {
        if (index % 2 !== 0 || normalize(part) !== entry.text) {
          return part;
        }
        matched = true;
        const lead = /^[^A-Za-z]*/.exec(part)![0];
        const trail = /[^A-Za-z]*$/.exec(part)![0];
        return `${lead}${BLANK}${trail}`;
      })
      .join('');
    if (!matched) {
      continue;
    }
    // The same rule the name clues follow: blanking has to leave something
    // behind. A sentence that is only the word collapses to a bare "____",
    // which is not a clue.
    const context = blanked
      .split(BLANK)
      .join(' ')
      .replace(/[^A-Za-z]+/g, '');
    if (context.length < 3) {
      continue;
    }
    return blanked;
  }
  return null;
};

const oracleWordClue = (entry: CrosswordVocabEntry, ctx: ClueContext, rng: () => number): string | null =>
  synonymClue(entry, rng) ?? blankInRulesText(entry, ctx, rng);

/** A clue with no filter behind it, or null when the class had nothing to say. */
const plain = (clue: string | null): CrosswordClue | null => (clue ? { clue } : null);

const buildClue = (entry: CrosswordVocabEntry, rng: () => number, ctx: ClueContext): CrosswordClue | null => {
  const suffix = FILTER_CLUE_SUFFIX[entry.entryClass];
  if (suffix !== undefined) {
    return filterClue(entry, ctx, suffix);
  }
  switch (entry.entryClass) {
    case 'nameWord':
      return plain(nameWordClue(entry, rng));
    case 'nameBigram':
      return plain(nameWordClue(entry, rng, blankNameBigram));
    case 'creatureType': {
      const name = pickCardName(ctx.byCreatureType.get(entry.text) ?? [], entry.text, ctx, rng);
      return plain(name && `a type of ${name}`);
    }
    case 'keyword': {
      const name = pickCardName(ctx.byKeyword.get(entry.text) ?? [], entry.text, ctx, rng);
      return plain(name && `${name} has this keyword`);
    }
    case 'setCode':
      return plain(setCodeClue(entry, ctx, rng));
    case 'oracleWord':
      return plain(oracleWordClue(entry, ctx, rng));
    default:
      return null;
  }
};

/**
 * The clue for one entry. `clue` is always a non-empty string: every slot in a
 * playable grid needs something written next to it, so a class whose sources
 * didn't work out — or whose clue would have given the answer away — falls back to
 * naming what kind of answer it wants.
 *
 * The leak check is here, over every class, rather than only where a leak was
 * expected. Two real ones turn up in the catalog that no per-class rule would have
 * caught: the nameWord BFM blanks to "____ (Big Furry Monster)", whose initials are
 * the answer, and the creature type MASTICORE has no card to cite that isn't named
 * after it ("a type of Razormane Masticore"). Both now fall back, because a bland
 * clue beats a free one. It costs about one entry in ten thousand.
 *
 * `rng` is the puzzle's seeded generator and is consumed in call order, so clues
 * must be generated for the same slots in the same order to reproduce. The
 * fallback consumes none, so a leak doesn't shift the clues after it.
 */
export const clueFor = (
  entry: CrosswordVocabEntry,
  rng: () => number,
  ctx: ClueContext = getClueContext(),
): CrosswordClue => {
  const built = buildClue(entry, rng, ctx);
  const clue = built?.clue.trim();
  if (!clue || revealsEntry(clue, entry)) {
    return { clue: `${entry.text.length}-letter ${CLASS_NOUN[entry.entryClass] ?? 'answer'}` };
  }
  return built!.clueFilter ? { clue, clueFilter: built!.clueFilter } : { clue };
};
