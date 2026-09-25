import Card from '@utils/datatypes/Card';
import { ManaMatrixCategory } from '@utils/datatypes/ManaMatrix';
import { FilterFunction, makeFilter } from '@utils/filtering/FilterCards';
import seedrandom from 'seedrandom';
import catalog from 'serverutils/cardCatalog';

import { CARD_TYPES, COLOR_COMBINATIONS, COLORS, CREATURE_TYPES, KEYWORDS, ORACLE_TERMS } from './categoryPools';
import { eligibleArtTags, eligibleOracleTags } from './tagFrequencies';

export interface GeneratedPuzzle {
  columns: ManaMatrixCategory[];
  rows: ManaMatrixCategory[];
  counts: number[][]; // counts[row][col]
}

// Every cell must have at least this many distinct valid answers. The original
// allowed 1, but without a searchable answer key that makes near-impossible
// cells; 5 keeps every cell plausibly guessable.
export const MIN_ANSWERS_PER_CELL = 5;
const MAX_GENERATION_ATTEMPTS = 30;

// Tags need a healthy answer pool before they're interesting categories.
const MIN_TAG_NAMES = 150;

// Sets eligible as categories: real paper releases with a full card list.
const ELIGIBLE_SET_TYPES = new Set(['expansion', 'core', 'masters']);
const MIN_SET_CARDS = 150;

type Rng = () => number;

const pick = <T>(rng: Rng, array: T[]): T => array[Math.floor(rng() * array.length)]!;

// The literal filter-text templates, shared by the random generators and the
// exhaustive enumeration below so the parseability tests cover exactly what
// generation can produce.
const CMC_VALUES = ['=0', '=1', '=2', '=3', '=5', '=6', '=7', '>7'];
const CI_COUNTS = [0, 1, 2, 3, 5];
const MAX_POWER_OR_TOUGHNESS = 7; // exclusive: values are 0-6
const MANA_GENERICS = [0, 1, 2];
const MANA_PIPS = [1, 2];

const creatureTypeText = (creatureType: string): string => `type:${creatureType}`;
const cmcText = (value: string): string => `cmc${value}`;
const ciCountText = (count: number): string => `ci=${count}`;
const ciComboText = (combo: string): string => `ci=${combo}`;
const cardTypeText = (cardType: string): string => `type:${cardType}`;
const powerText = (power: number): string => `power=${power}`;
const toughnessText = (toughness: number): string => `toughness=${toughness}`;
const keywordText = (keyword: string): string => `keyword:${keyword}`;
const setText = (setCode: string): string => `set:${setCode}`;
const oracleTagText = (slug: string): string => `otag:"${slug}"`;
const artTagText = (slug: string): string => `atag:"${slug}"`;
const oracleTermText = (term: string): string => `o:"${term}"`;
const manaText = (generic: number, color: string, pips: number): string => {
  let base = `mana=`;
  if (generic > 0) {
    base += `{${generic}}`;
  }
  for (let i = 0; i < pips; i++) {
    base += `{${color}}`;
  }
  return base;
};

const shuffle = <T>(rng: Rng, array: T[]): T[] => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

const nDistinctRandom = <T>(rng: Rng, array: T[], n: number): T[] => shuffle(rng, array).slice(0, n);

const eligibleSets = (date: string): string[] =>
  Object.values(catalog.setdict)
    .filter(
      (set) =>
        ELIGIBLE_SET_TYPES.has(set.setType) &&
        !set.digital &&
        set.cardCount >= MIN_SET_CARDS &&
        set.releasedAt !== null &&
        set.releasedAt <= date,
    )
    .map((set) => set.code)
    .sort();

export interface GeneratorPools {
  sets: string[];
  oracleTags: string[];
  artTags: string[];
}

/**
 * The value-category generators, ported from the original plus the new
 * oracle-tag and art-tag categories. At most one category per generator kind
 * appears in a puzzle (generators are drawn without replacement).
 */
const makeValueGenerators = (rng: Rng, pools: GeneratorPools): (() => string)[] => {
  const generators: (() => string)[] = [
    () => creatureTypeText(pick(rng, CREATURE_TYPES)),
    () => cmcText(pick(rng, CMC_VALUES)),
    () => ciCountText(pick(rng, CI_COUNTS)),
    () => ciComboText(pick(rng, COLOR_COMBINATIONS)),
    () => cardTypeText(pick(rng, CARD_TYPES)),
    () => powerText(Math.floor(rng() * MAX_POWER_OR_TOUGHNESS)),
    () => toughnessText(Math.floor(rng() * MAX_POWER_OR_TOUGHNESS)),
    () => keywordText(pick(rng, KEYWORDS)),
    () => manaText(pick(rng, MANA_GENERICS), pick(rng, COLORS), pick(rng, MANA_PIPS)),
  ];

  if (pools.sets.length > 0) {
    generators.push(() => setText(pick(rng, pools.sets)));
  }
  if (pools.oracleTags.length > 0) {
    generators.push(() => oracleTagText(pick(rng, pools.oracleTags)));
  }
  if (pools.artTags.length > 0) {
    generators.push(() => artTagText(pick(rng, pools.artTags)));
  }

  return generators;
};

/**
 * Every filter text the generators above can possibly emit for the given
 * pools. Exists so tests can prove each one parses in the filter grammar.
 */
export const enumerateAllCategoryTexts = (pools: GeneratorPools): string[] => [
  ...CREATURE_TYPES.map(creatureTypeText),
  ...CMC_VALUES.map(cmcText),
  ...CI_COUNTS.map(ciCountText),
  ...COLOR_COMBINATIONS.map(ciComboText),
  ...CARD_TYPES.map(cardTypeText),
  ...Array.from({ length: MAX_POWER_OR_TOUGHNESS }, (_, value) => powerText(value)),
  ...Array.from({ length: MAX_POWER_OR_TOUGHNESS }, (_, value) => toughnessText(value)),
  ...KEYWORDS.map(keywordText),
  ...MANA_GENERICS.flatMap((generic) =>
    COLORS.flatMap((color) => MANA_PIPS.map((pips) => manaText(generic, color, pips))),
  ),
  ...pools.sets.map(setText),
  ...pools.oracleTags.map(oracleTagText),
  ...pools.artTags.map(artTagText),
  ...ORACLE_TERMS.map(oracleTermText),
];

export const generateCategoryTexts = (rng: Rng, pools: GeneratorPools): string[] => {
  const numOracle = [0, 1, 1, 2, 2, 3][Math.floor(rng() * 6)]!;

  return shuffle(rng, [
    ...nDistinctRandom(rng, makeValueGenerators(rng, pools), 6 - numOracle).map((generator) => generator()),
    ...nDistinctRandom(rng, ORACLE_TERMS, numOracle).map(oracleTermText),
  ]);
};

const compileOrNull = (filterText: string): FilterFunction | null => {
  const { err, filter } = makeFilter(filterText);
  if (err || !filter) {
    return null;
  }
  return filter;
};

/**
 * One pass over all non-extra printings: a card name belongs to cell
 * (row, col) when a SINGLE printing satisfies both that row's and that
 * column's filter — the same per-printing semantics validateAnswers uses, so
 * the stored counts always agree with answer validation (this matters for
 * printing-specific filters like set: and atag:).
 */
const computeCellCounts = (columnFilters: FilterFunction[], rowFilters: FilterFunction[]): number[][] => {
  const cellNames: Set<string>[][] = Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => new Set<string>()),
  );

  for (const details of catalog.printedCardList) {
    const card = { details } as Card;

    const columnPasses = columnFilters.map((filter) => filter(card));
    if (!columnPasses.some(Boolean)) {
      continue;
    }
    const rowPasses = rowFilters.map((filter) => filter(card));
    if (!rowPasses.some(Boolean)) {
      continue;
    }

    for (let row = 0; row < 3; row++) {
      if (!rowPasses[row]) continue;
      for (let col = 0; col < 3; col++) {
        if (columnPasses[col]) {
          cellNames[row]![col]!.add(details.name_lower);
        }
      }
    }
  }

  return cellNames.map((row) => row.map((names) => names.size));
};

const describeFilter = (filter: FilterFunction, filterText: string): string => {
  // The grammar's generated fragments for tag and set filters are stilted
  // ('atag contains exactly "..."', 'set is "dst"'), so those get bespoke
  // wording; everything else uses the filter's own .describe translation.
  const tagMatch = filterText.match(/^(otag|atag):"(.+)"$/);
  if (tagMatch) {
    return `${tagMatch[1] === 'otag' ? 'oracle' : 'art'} tag is "${tagMatch[2]}"`;
  }

  const setMatch = filterText.match(/^set:(.+)$/);
  if (setMatch) {
    const setCode = setMatch[1]!;
    const setName = catalog.setdict[setCode]?.name;
    return setName ? `printed in ${setName} (${setCode.toUpperCase()})` : `printed in set "${setCode}"`;
  }

  const fragment = filter.describe?.trim();
  return fragment && fragment.length > 0 ? fragment : filterText;
};

/**
 * Generates the puzzle for a date. Deterministic for a given date and catalog:
 * the RNG is seeded with the date (a local instance — never seed the global
 * Math.random inside the server). Throws if no viable puzzle is found within
 * the attempt bound; the caller (rotate endpoint) surfaces that as a 500.
 */
export const generatePuzzle = (date: string): GeneratedPuzzle => {
  const rng = seedrandom(date);
  const pools: GeneratorPools = {
    sets: eligibleSets(date),
    oracleTags: eligibleOracleTags(MIN_TAG_NAMES),
    artTags: eligibleArtTags(MIN_TAG_NAMES),
  };

  const start = Date.now();

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const texts = generateCategoryTexts(rng, pools);
    if (new Set(texts).size !== 6) {
      continue;
    }

    const filters = texts.map(compileOrNull);
    if (filters.some((filter) => filter === null)) {
      // A pool entry produced unparseable syntax; tests guard against this,
      // but never let one bad category wedge the rotation.
      continue;
    }

    const columnFilters = filters.slice(0, 3) as FilterFunction[];
    const rowFilters = filters.slice(3, 6) as FilterFunction[];

    const counts = computeCellCounts(columnFilters, rowFilters);
    if (counts.some((row) => row.some((count) => count < MIN_ANSWERS_PER_CELL))) {
      continue;
    }

    const toCategory = (filterText: string, filter: FilterFunction): ManaMatrixCategory => ({
      filterText,
      description: describeFilter(filter, filterText),
    });

    console.info(
      `ManaMatrix puzzle for ${date} generated in ${Date.now() - start}ms after ${attempt} attempt(s): ${texts.join(' | ')}`,
    );

    return {
      columns: texts.slice(0, 3).map((text, i) => toCategory(text, columnFilters[i]!)),
      rows: texts.slice(3, 6).map((text, i) => toCategory(text, rowFilters[i]!)),
      counts,
    };
  }

  throw new Error(
    `Failed to generate a ManaMatrix puzzle for ${date} within ${MAX_GENERATION_ATTEMPTS} attempts (${Date.now() - start}ms)`,
  );
};
