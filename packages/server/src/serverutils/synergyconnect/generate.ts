import { DefaultPrintingPreference } from '@utils/datatypes/Card';
import { SynergyConnectCard, SynergyConnectGroup } from '@utils/datatypes/SynergyConnect';
import { makeFilter } from '@utils/filtering/FilterCards';
import seedrandom from 'seedrandom';
import { getRelatedCards } from 'serverutils/carddb';
import catalog from 'serverutils/cardCatalog';
import { searchAllCards } from 'serverutils/tools';

import { COLOR_COMBINATIONS, KEYWORDS } from '../manamatrix/categoryPools';

export interface GeneratedPuzzle {
  theme: { filterText: string; description: string };
  groups: SynergyConnectGroup[];
  order: number[];
}

const GROUP_COUNT = 4;
const CARDS_PER_GROUP = 4;
// Commanders are drawn from the most-cubed legendary creatures in the theme, so
// the puzzle uses cards players actually recognize.
const COMMANDER_POOL_SIZE = 25;
const MIN_COMMANDERS = 12;
const MAX_GENERATION_ATTEMPTS = 40;
// Two commanders may share at most this many cards in their synergy pools
// before they're considered too alike to anchor distinct groups.
const MAX_SHARED_SYNERGIES = 2;

// Themes are only flavor — they never narrow the answer down to one group, so
// showing them is safe.
const ELIGIBLE_SET_TYPES = new Set(['expansion', 'core', 'masters']);
const MIN_SET_CARDS = 150;

type Rng = () => number;

const pick = <T>(rng: Rng, array: T[]): T => array[Math.floor(rng() * array.length)]!;

const shuffle = <T>(rng: Rng, array: T[]): T[] => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

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

const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

/**
 * Short label for the theme pool, completing the sentence "Legendary creatures
 * ___". The filter grammar's own phrasing is too stilted to show as flavor
 * ('where keywords contains exactly "first strike"'), so each pool gets
 * bespoke wording.
 */
const describeTheme = (filterText: string): string => {
  const setMatch = filterText.match(/^set:(.+)$/);
  if (setMatch) {
    const setCode = setMatch[1]!;
    const setName = catalog.setdict[setCode]?.name;
    return setName ? `from ${setName} (${setCode.toUpperCase()})` : `from set "${setCode}"`;
  }

  const keywordMatch = filterText.match(/^keyword:"?([^"]+)"?$/);
  if (keywordMatch) {
    const keyword = keywordMatch[1]!;
    return `with ${keyword.charAt(0).toUpperCase()}${keyword.slice(1)}`;
  }

  const colorMatch = filterText.match(/^ci=([WUBRG]+)$/);
  if (colorMatch) {
    const letters = [...colorMatch[1]!];
    if (letters.length === 5) {
      return 'in all five colors';
    }
    const names = letters.map((letter) => COLOR_NAMES[letter] ?? letter);
    const last = names.pop()!;
    return names.length > 0 ? `in ${names.join(', ')} and ${last}` : `in ${last}`;
  }

  return filterText;
};

/** The theme pools, ported from GdekkerSite's mtgconnect valueTerms. */
const themeGenerators = (rng: Rng, sets: string[]): (() => string)[] => {
  const generators: (() => string)[] = [
    () => `ci=${pick(rng, COLOR_COMBINATIONS)}`,
    () => `keyword:${pick(rng, KEYWORDS)}`,
  ];
  if (sets.length > 0) {
    generators.push(() => `set:${pick(rng, sets)}`);
  }
  return generators;
};

/**
 * Builds the daily puzzle: four popular legendary creatures from a themed pool,
 * each with four of its most synergistic cards. Every one of the sixteen cards
 * must be distinct and must not itself be one of the commanders, so each card
 * belongs to exactly one group.
 *
 * Deterministic for a given date and catalog. Throws if no viable puzzle is
 * found within the attempt bound.
 */
export const generatePuzzle = (date: string): GeneratedPuzzle => {
  const rng = seedrandom(date);
  const sets = eligibleSets(date);
  const start = Date.now();

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const filterText = pick(rng, themeGenerators(rng, sets))();
    const { err, filter } = makeFilter(`t:"legendary creature" ${filterText}`);
    if (err || !filter) {
      continue;
    }

    // Most-cubed first, so commanders are recognizable.
    const candidates = searchAllCards(filter, 'Cube Count', 'descending', 'names');
    if (candidates.length < MIN_COMMANDERS) {
      continue;
    }

    const pool = shuffle(rng, candidates.slice(0, COMMANDER_POOL_SIZE));
    const commanderOracleIds = new Set(pool.map((card) => card.oracle_id));

    const groups: SynergyConnectGroup[] = [];
    const usedOracleIds = new Set<string>();
    // Synergy pools of the commanders already chosen, so the next one can be
    // required to have low synergy with all of them.
    const chosenSynergyPools: Set<string>[] = [];
    const chosenCommanderIds: string[] = [];

    for (const candidate of pool) {
      const related = getRelatedCards(candidate.oracle_id, DefaultPrintingPreference);
      const synergistic = related.synergistic?.top ?? [];
      const candidatePool = new Set(synergistic.map((details) => details.oracle_id));

      // Keep the groups distinct: reject a commander that is itself a top
      // synergy of a chosen one, or whose synergy pool overlaps theirs.
      const tooSimilar = chosenCommanderIds.some((chosenId, i) => {
        if (candidatePool.has(chosenId) || chosenSynergyPools[i]!.has(candidate.oracle_id)) {
          return true;
        }
        let shared = 0;
        for (const oracleId of candidatePool) {
          if (chosenSynergyPools[i]!.has(oracleId)) {
            shared += 1;
          }
        }
        return shared > MAX_SHARED_SYNERGIES;
      });
      if (tooSimilar) {
        continue;
      }

      // A card can only anchor a group if four of its synergies are unused by
      // another group and aren't commanders themselves.
      const cards: SynergyConnectCard[] = [];
      for (const details of synergistic) {
        if (cards.length >= CARDS_PER_GROUP) {
          break;
        }
        if (usedOracleIds.has(details.oracle_id) || commanderOracleIds.has(details.oracle_id)) {
          continue;
        }
        cards.push({ name: details.name, oracleId: details.oracle_id });
      }

      if (cards.length < CARDS_PER_GROUP) {
        continue;
      }

      for (const card of cards) {
        usedOracleIds.add(card.oracleId);
      }
      usedOracleIds.add(candidate.oracle_id);
      chosenSynergyPools.push(candidatePool);
      chosenCommanderIds.push(candidate.oracle_id);
      groups.push({
        commander: { name: candidate.name, oracleId: candidate.oracle_id },
        cards,
      });

      if (groups.length >= GROUP_COUNT) {
        break;
      }
    }

    if (groups.length < GROUP_COUNT) {
      continue;
    }

    // Board order over the flattened [group * 4 + card] indices.
    const order = shuffle(
      rng,
      Array.from({ length: GROUP_COUNT * CARDS_PER_GROUP }, (_, index) => index),
    );

    console.info(
      `Synergy Connect puzzle for ${date} generated in ${Date.now() - start}ms after ${attempt} attempt(s): ${filterText} — ${groups
        .map((group) => group.commander.name)
        .join(', ')}`,
    );

    return {
      theme: { filterText, description: describeTheme(filterText) },
      groups,
      order,
    };
  }

  throw new Error(
    `Failed to generate a Synergy Connect puzzle for ${date} within ${MAX_GENERATION_ATTEMPTS} attempts (${Date.now() - start}ms)`,
  );
};
