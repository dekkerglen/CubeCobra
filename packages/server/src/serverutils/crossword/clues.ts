import { normalizeName } from '@utils/cardutil';
import Card, { CardDetails } from '@utils/datatypes/Card';
import { CrosswordEntryClass, CrosswordVocabEntry } from '@utils/datatypes/Crossword';
import { makeFilter } from '@utils/filtering/FilterCards';
import { clearPrintingIndexCache, originalPrintings } from 'serverutils/cardPrintings';
import { describeFilterTerms } from 'serverutils/filterDescription';
import { clearTagCountsCache, eligibleOracleTagCounts, MIN_RECOGNISABLE_TAG_NAMES } from 'serverutils/tagEligibility';

import { CROSSWORD_SYNONYMS } from './synonyms.generated';
import {
  BLANK,
  blankWordInRulesText,
  CLUE_SOURCES_PER_KEY,
  creatureSubtypes,
  nameTokens,
  normalize,
  oracleWords,
  redactedRulesLine,
  spellsOutAnswer,
  splitNameParts,
} from './text';

/**
 * Clue text for crossword entries. Clues are built per puzzle and never stored,
 * so everything here is a pure function of a vocabulary entry, a seeded rng and
 * the catalog-derived `ClueContext`. Nothing in this file may call Math.random:
 * a seed has to reproduce its clues along with its grid.
 *
 * How a name or a rules text is cut into words, and whether a word can be blanked
 * out of a rules text at all, live in `./text` — shared with the vocabulary build,
 * which uses them to decide what becomes an entry in the first place.
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
  /**
   * The one card this clue cites, for the clue shapes that blank a word out of a
   * card name or quote a card's rules text.
   *
   * Those shapes pick their card from a pool with the puzzle's rng, so the card
   * the clue is about is not the card the entry happens to be displayed as. Left
   * unset the answer key reads off `entry.display` instead and disagrees with the
   * clue: REITO clued as "____ Lantern" came back in the key as "Reito Sentinel",
   * which is a different card and makes the explanation incoherent. It is not a
   * rare disagreement either — the pool exists precisely so successive puzzles
   * cite different cards.
   *
   * Unset for the shapes that cite no particular card: a creature type, a keyword
   * and a set code are clued *with* a card but answered by themselves, and a
   * translated filter describes the entry's own card.
   */
  clueSource?: string;
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
 *
 * Which card it landed on comes back as `clueSource`, because the answer key has
 * to name the card the clue blanked rather than the entry's representative one —
 * see `CrosswordClue.clueSource`.
 */
export const nameWordClue = (
  entry: CrosswordVocabEntry,
  rng: () => number,
  blank: (cardName: string, text: string) => string | null = blankNameWord,
): CrosswordClue | null => {
  const sources = entry.sourceCardNames ?? (entry.sourceCardName ? [entry.sourceCardName] : []);
  if (sources.length === 0) {
    return null;
  }

  for (const source of rotated(sources, rng)) {
    const clue = blank(source, entry.text);
    if (clue) {
      return { clue, clueSource: source };
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
 * and the printing index go with it — the context is built from both, so leaving
 * either cached would describe the previous catalog.
 */
export const clearClueContextCache = (): void => {
  cachedContext = undefined;
  clearTagCountsCache();
  clearPrintingIndexCache();
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
 * A list in a seeded random order. Fisher-Yates, so every permutation is reachable
 * and the same rng state always produces the same one.
 */
const shuffled = <T>(items: T[], rng: () => number): T[] => {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1));
    [out[index], out[swap]] = [out[swap]!, out[index]!];
  }
  return out;
};

/**
 * Filter terms for a card: colour identity, then everything else in a seeded
 * random order.
 *
 * `narrowingFilter` walks this list and stops as soon as the filter is specific
 * enough, so a term's position *is* its priority — anything near the end is never
 * reached. Ranking the attributes once and for all therefore meant every clue in
 * every puzzle led with the same two or three things: colour identity, type line,
 * mana value. Adding better attributes (keywords, then oracle tags) widened the
 * pool without touching that, because the new ones landed in fixed positions too.
 * So the order is drawn per clue instead, from the puzzle's rng, and the same card
 * is described by its set in one puzzle and by its keywords in the next.
 *
 * Two things stay fixed, and only two:
 *
 * - Colour identity opens. It is the one attribute every Magic player reads first,
 *   it is true of every card including the colourless ones, and it cuts the
 *   catalog by an order of magnitude for free. A clue that opens somewhere else
 *   reads as though it started mid-sentence.
 * - The statistical tail — mana value, power, toughness, rarity — is drawn *after*
 *   the descriptive attributes, not among them. "power is 3, toughness is 3" is a
 *   stat block rather than a description, and letting it compete for the second
 *   slot is exactly the complaint this change answers. It still gets used, because
 *   plenty of cards have nothing else that narrows.
 *
 * Everything else — the creature's subtypes, its card types, its keywords, its
 * oracle tags, the set it premiered in, the year — competes on equal footing.
 */
const filterTerms = (details: CardDetails, ctx: ClueContext, forbidden: Set<string>, rng: () => number): string[] => {
  const { types, subtypes } = typeWords(details.type);
  const descriptive: string[] = [];
  const statistical: string[] = [];

  // A planeswalker's subtype is a character's name, so it is never a fair clue
  // term. Usually it repeats the card's own name and the name-word guard drops
  // it — but on a Universes Beyond reskin the two come apart: "Meiko, ..." keeps
  // the type line "Planeswalker — Chandra", nothing in the name matches, and the
  // clue ends up describing a character who isn't the answer. Dropping the
  // subtype costs these cards some precision and stops them lying.
  if (!types.some((type) => type.toLowerCase() === 'planeswalker')) {
    for (const subtype of subtypes) {
      descriptive.push(`t:${filterValue(subtype)}`);
    }
  }
  for (const type of types) {
    descriptive.push(`t:${filterValue(type)}`);
  }
  // An evergreen keyword is something every player knows, where most oracle tags
  // are Tagger vocabulary — but both say what the card *does*, which colour and
  // mana value never will, so both belong in the descriptive draw.
  for (const keyword of details.keywords ?? []) {
    if (/^[A-Za-z][A-Za-z' -]*$/.test(keyword)) {
      descriptive.push(`keyword:${filterValue(keyword)}`);
    }
  }
  descriptive.push(...tagTerms(details, ctx, forbidden));
  // Where and when it premiered. Both used to sit in the tail and go unreached,
  // and "first printed in Dominaria (DOM)" is one of the things the clues were
  // missing most.
  if (details.set && /^[A-Za-z0-9]+$/.test(details.set)) {
    descriptive.push(`s:${details.set.toLowerCase()}`);
  }
  if (Number.isInteger(details.firstPrintYear)) {
    descriptive.push(`fy=${details.firstPrintYear}`);
  }

  if (Number.isInteger(details.cmc)) {
    statistical.push(`mv=${details.cmc}`);
  }
  if (details.power && /^\d+$/.test(details.power)) {
    statistical.push(`pow=${details.power}`);
  }
  if (details.toughness && /^\d+$/.test(details.toughness)) {
    statistical.push(`tou=${details.toughness}`);
  }
  if (details.rarity && FILTERABLE_RARITIES.has(details.rarity.toLowerCase())) {
    statistical.push(`r:${details.rarity.toLowerCase()}`);
  }

  return [
    `ci=${colorIdentityValue(details.color_identity ?? [])}`,
    ...shuffled(descriptive, rng),
    ...shuffled(statistical, rng),
  ];
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
const narrowingFilter = (
  details: CardDetails,
  ctx: ClueContext,
  entryText: string,
  rng: () => number,
): string[] | null => {
  // Letterless tokens — the "40,000" of "Warhammer 40,000" — normalize to nothing,
  // and so does the value of `mv=3`. Dropping them keeps a number from matching a
  // number and taking a good term out of every clue for the card.
  const forbidden = new Set(
    [normalize(details.name), ...nameTokens(details.name).map(normalize), entryText].filter(Boolean),
  );
  const accepted: string[] = [];
  let matches = ctx.cards;

  for (const term of filterTerms(details, ctx, forbidden, rng)) {
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

/**
 * Whether a solver could read the answer straight off this clue, spelled out by
 * consecutive words or as their initials.
 *
 * `spellsOutAnswer` is the rule; this is the entry's view of it. The card's own
 * name is checked as well as the entry text, since naming the card gives away
 * every class derived from it.
 *
 * The rule lives in `./text` because the vocabulary build applies it too: a rules
 * word whose only blankable sentence gives the word away is not vocabulary, and
 * `blankWordInRulesText` refuses it on the build's behalf and the writer's alike.
 */
const revealsEntry = (text: string, entry: CrosswordVocabEntry): boolean =>
  spellsOutAnswer(text, entry.text, normalize(entry.sourceCardName ?? entry.display));

/**
 * A quoted line of the card's own rules text, name redacted: "Whenever ~ deals
 * combat damage to a player, draw a card."
 *
 * The best clue material the catalog has, and for a long time the clues didn't use
 * it: a translated filter says what a card *costs* and what colour it *is*, while
 * its rules text says what it does, in Magic's own words. `redactedRulesLine`
 * decides what is quotable and does the redacting, shared with the rules-word
 * clues so there is one anonymiser rather than two.
 *
 * The suffix classes get the line with any full stop dropped, because ", abbrev."
 * reads as a clause of the sentence and "Unsummon target creature., abbrev." does
 * not. Null for vanilla creatures, most lands, and anything whose text is a bare
 * keyword — those take the filter shape instead.
 */
const rulesLineClue = (details: CardDetails, suffix: string): CrosswordClue | null => {
  const line = redactedRulesLine(details.oracle_text ?? '', details.name);
  if (!line) {
    return null;
  }
  // The quoted card, for the answer key: this shape is about one specific card's
  // text, and for a legend's name or initials that card is not what `display` says.
  return { clue: suffix ? `${line.replace(/\.$/, '')}${suffix}` : line, clueSource: details.name };
};

/**
 * A plain-English reading of a filter that narrows to the card, plus the suffix
 * for which part of it is wanted.
 *
 * "color identity is exactly Blue, mana value is 4, type line includes
 * Planeswalker, abbrev." — which asks for JACE without printing it, where the
 * specified format ("Jace, the Mind Sculptor, abbrev.") answered itself.
 *
 * Which attributes it reaches for varies per clue; see `filterTerms`.
 */
const filterClue = (
  details: CardDetails,
  entry: CrosswordVocabEntry,
  ctx: ClueContext,
  suffix: string,
  rng: () => number,
): CrosswordClue | null => {
  const terms = narrowingFilter(details, ctx, entry.text, rng);
  if (!terms) {
    return null;
  }
  return { clue: `${describeFilterTerms(terms)}${suffix}`, clueFilter: terms.join(' ') };
};

/**
 * How often the rules-text shape is tried before the filter shape. Not a
 * replacement for it: half and half keeps the mix varied, lets the same card clue
 * differently in different puzzles, and means a grid full of vanilla creatures
 * still gets clued at all.
 */
const RULES_LINE_SHARE = 0.5;

/**
 * The clue for an answer that is part of one card, in whichever shape the puzzle's
 * rng draws: a line of the card's own rules text, or a filter that narrows to it.
 *
 * Both shapes are checked for leaks here rather than only in `clueFor`, so a shape
 * that would have given the answer away falls through to the other one instead of
 * all the way to the clue of last resort.
 *
 * The type line is the third and last shape, for a card that narrowed to nothing
 * and has no quotable text: it still describes the card without naming it, which
 * is a clue, just not a filter. Returns null — and so falls through to the clue of
 * last resort — only when the card isn't in the context at all.
 */
const cardPartClue = (
  entry: CrosswordVocabEntry,
  ctx: ClueContext,
  suffix: string,
  rng: () => number,
): CrosswordClue | null => {
  const name = entry.sourceCardName ?? entry.display;
  // `normalizeName`, not toLowerCase: `name_lower` is accent-folded, so a plain
  // lowercase of "Gríma, Saruman's Footman" misses the card and every clue for
  // every entry off an accented name comes out generic.
  const index = ctx.byNameLower.get(normalizeName(name));
  if (index === undefined) {
    return null;
  }
  const details = ctx.cards[index]!;

  const rules = (): CrosswordClue | null => rulesLineClue(details, suffix);
  const filter = (): CrosswordClue | null => filterClue(details, entry, ctx, suffix, rng);
  const shapes = rng() < RULES_LINE_SHARE ? [rules, filter] : [filter, rules];

  for (const shape of shapes) {
    const built = shape();
    if (built && !revealsEntry(built.clue, entry)) {
      return built;
    }
  }

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

/** A clue citing no particular card, or null when the class had nothing to say. */
const plain = (clue: string | null): CrosswordClue | null => (clue ? { clue } : null);

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

/**
 * The word blanked out of one of the cards whose rules text uses it.
 *
 * Which card is the only decision made here; whether a given card can supply the
 * clue is `blankWordInRulesText`'s, in `./text`, because the vocabulary build asks
 * the same question of the same cards before admitting the word at all. Two
 * implementations would mean the build could admit a word this then fails to clue.
 *
 * Returns null only when every card in the pool failed, which the build has
 * already ruled out for anything that reached the vocabulary.
 */
const blankInRulesText = (entry: CrosswordVocabEntry, ctx: ClueContext, rng: () => number): CrosswordClue | null => {
  // Every source, not `usableSources`: that filter exists to stop a clue naming
  // a card whose name gives the answer away, and here the name is removed.
  for (const index of rotated(ctx.byOracleWord.get(entry.text) ?? [], rng)) {
    const details = ctx.cards[index]!;
    const blanked = blankWordInRulesText(details.oracle_text ?? '', details.name, entry.text);
    if (blanked) {
      return { clue: blanked, clueSource: details.name };
    }
  }
  return null;
};

/**
 * The two ways a rules word is clued, and there is no third — which is why the
 * vocabulary build admits a rules word only if one of them will work for it (see
 * `clueableRulesWords` in vocabulary.ts). This never returns null for a word that
 * came out of the vocabulary.
 */
const oracleWordClue = (entry: CrosswordVocabEntry, ctx: ClueContext, rng: () => number): CrosswordClue | null =>
  plain(synonymClue(entry, rng)) ?? blankInRulesText(entry, ctx, rng);

const buildClue = (entry: CrosswordVocabEntry, rng: () => number, ctx: ClueContext): CrosswordClue | null => {
  const suffix = FILTER_CLUE_SUFFIX[entry.entryClass];
  if (suffix !== undefined) {
    return cardPartClue(entry, ctx, suffix, rng);
  }
  switch (entry.entryClass) {
    case 'nameWord':
      return nameWordClue(entry, rng);
    case 'nameBigram':
      return nameWordClue(entry, rng, blankNameBigram);
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
      return oracleWordClue(entry, ctx, rng);
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
 * That fallback is a safety net and nothing a solver should want to meet: a slot
 * clued "6-letter word from Magic rules text" cannot be solved. It is unreachable
 * for a rules word, because the vocabulary build refuses a rules word it can't
 * clue (see `clueableRulesWords` in vocabulary.ts) rather than anything downstream
 * checking for one. The net stays for the classes that have no such gate, where it
 * is rare: sweeping the whole vocabulary leaves it on about forty creature types
 * and four keywords, all of them types whose every card is named after them, plus
 * one acronym and one name word.
 *
 * The leak check is here, over every class, rather than only where a leak was
 * expected. Two real ones turn up in the catalog that no per-class rule would have
 * caught: the nameWord BFM blanks to "____ (Big Furry Monster)", whose initials are
 * the answer, and the creature type MASTICORE has no card to cite that isn't named
 * after it ("a type of Razormane Masticore"). Both fall back, because a bland clue
 * beats a free one.
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
    // No clue, so nothing cited: the fallback must not carry a `clueSource` the
    // answer key would then show beside an answer the clue never mentioned.
    return { clue: `${entry.text.length}-letter ${CLASS_NOUN[entry.entryClass] ?? 'answer'}` };
  }
  return { ...built!, clue };
};
