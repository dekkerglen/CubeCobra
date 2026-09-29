import { DefaultPrintingPreference } from '@utils/datatypes/Card';
import { SynergyConnectCard, SynergyConnectGroup } from '@utils/datatypes/SynergyConnect';
import { makeFilter } from '@utils/filtering/FilterCards';
import seedrandom from 'seedrandom';
import { getRelatedCards } from 'serverutils/carddb';
import { searchAllCards } from 'serverutils/tools';

import { drawTheme, LEGENDARY_CREATURE_FILTER, SynergyConnectThemePools, themePools } from './themes';

export interface GeneratedPuzzle {
  theme: { filterText: string; description: string };
  groups: SynergyConnectGroup[];
  order: number[];
}

const GROUP_COUNT = 4;
const CARDS_PER_GROUP = 4;
/**
 * Anchors are drawn from the most-cubed legendary creatures in the theme, so the
 * puzzle uses cards players actually recognize.
 *
 * FORTY, RAISED FROM TWENTY-FIVE, AND THE NARROW THEMES ARE WHY.
 *
 * Twenty-five was fine for a pool of hundreds and is not fine for a guild. The
 * most-cubed two-colour legends are mostly the *same archetype* — Izzet's are all
 * spellslinger, Simic's all ramp-and-counters, Orzhov's all lifegain — so their
 * synergy pools are near-identical and `MAX_SHARED_SYNERGIES` rejects them against
 * each other. Measured over 60 dates per colour identity at 25, three guilds never
 * built at all (Izzet, Simic and Orzhov each 0/60, stalling at three groups every
 * time) and the kind averaged 27%. It is structural rather than unlucky: within
 * the 25 most-cubed Izzet legends there are no four with pairwise-disjoint
 * synergies, so no reshuffle finds them.
 *
 * Counter-intuitively the three-colour identities were nearly perfect at 25 (94%)
 * despite having a third as many legends — 24 to 55 each. A shard's legends are
 * idiosyncratic build-arounds rather than variations on one archetype, and variety
 * rather than depth is what this search actually needs.
 *
 * At 40: monocolour 100%, shard 100%, tribe 100%, guild 91% (weakest Selesnya at
 * 70%, and the ladder above absorbs it — over 180 dates the three guild misses all
 * built on the second draw). Ranks 21-40 of a guild are still cards a cube player
 * names on sight — Niv-Mizzet, Dracogenius, Zegana, Utopian Speaker, Greasefang,
 * Okiba Boss — at 1800 to 4000 cube inclusions, so the recognisability this
 * constant exists to protect survives the change.
 */
const COMMANDER_POOL_SIZE = 40;
/**
 * Legends a theme must have before it is worth searching at all.
 *
 * Ten, lowered from twelve, and `MIN_TRIBE_LEGENDS` in themes.ts is deliberately
 * the same number so a tribe that clears the band always clears this too. The only
 * themes anywhere near the floor are tribes and colourless (17 legends); every
 * colour identity is in the hundreds.
 */
const MIN_COMMANDERS = 10;
/**
 * Themes tried before a date gives up, each one a fresh draw.
 *
 * This is the retry ladder for a pool that is now deliberately narrow — see
 * themes.ts. A guild or an uncommon tribe is a few dozen legends rather than a few
 * hundred, so a drawn theme that can't produce four anchors with distinct enough
 * synergy pools is a normal outcome rather than an error, and the fix is another
 * theme rather than another shuffle of the same one.
 *
 * Measured over 180 consecutive dates: 177 built on the first draw and 3 on the
 * second, none needed a third, and nothing failed. Per kind on the first draw,
 * monocolour 44/44, shard 39/39, tribe 48/48, guild 46/49 — every failure was a
 * guild, which is what COMMANDER_POOL_SIZE above is about. Forty is therefore slack
 * rather than a working number; it is what makes a genuinely unlucky day still a
 * puzzle.
 *
 * An attempt is one filtered catalog scan — measured at a 148ms median and 775ms
 * worst case for a whole date — so forty attempts is a few seconds. Sized against
 * the 60s `res.setTimeout` in index.ts, which the rotate endpoint the daily jobs
 * lambda calls is subject to; the lambda's own 15-minute timeout is not the binding
 * constraint, and neither is anywhere close to binding here.
 *
 * There is deliberately no broad-theme fallback at the bottom of the ladder. A day
 * that quietly reverted to "creatures with haste" is the thing this change exists
 * to remove, so a date that exhausts forty draws throws and the rotation is
 * visibly missing instead.
 */
const MAX_GENERATION_ATTEMPTS = 40;
/**
 * Two anchors may share at most this many cards in their synergy pools before
 * they're considered too alike to anchor distinct groups.
 *
 * Unchanged, and deliberately so: it is what makes the four groups solvable rather
 * than four arbitrary partitions of sixteen overlapping cards. Narrowing the theme
 * pool made it much harder to satisfy — that difficulty is real and was absorbed by
 * COMMANDER_POOL_SIZE and the attempt ladder above rather than by relaxing this.
 */
const MAX_SHARED_SYNERGIES = 2;

type Rng = () => number;

const shuffle = <T>(rng: Rng, array: T[]): T[] => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

/**
 * Builds the daily puzzle: four popular legendary creatures from a themed pool,
 * each with four of its most synergistic cards. Every one of the sixteen cards
 * must be distinct and must not itself be one of the commanders, so each card
 * belongs to exactly one group.
 *
 * The theme comes from themes.ts and is one colour, one guild, one shard or wedge,
 * or one uncommon creature type — never anything as wide as a keyword.
 *
 * Deterministic for a given date and catalog: one `seedrandom` seeded off the date
 * drives the shuffles, and each attempt's theme is seeded off the date and the
 * attempt number. `Math.random` is never involved, which is what makes yesterday's
 * puzzle reproducible from its date alone.
 *
 * NOTE THAT CHANGING THE THEME POOL CHANGES WHAT AN UN-GENERATED DATE PRODUCES.
 * Puzzles already in Dynamo are untouched — rotation is idempotent and returns the
 * stored item — so the archive is safe, but every future date now draws from the
 * new pool, and so would any backfill of a past date that was never rotated.
 *
 * Throws if no viable puzzle is found within the attempt bound.
 *
 * `pools` is injectable so this can be exercised against a fixed tribe list; the
 * real caller reads them off the catalog.
 */
export const generatePuzzle = (date: string, pools: SynergyConnectThemePools = themePools()): GeneratedPuzzle => {
  const rng = seedrandom(date);
  const start = Date.now();

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const theme = drawTheme(date, attempt, pools);
    if (!theme) {
      continue;
    }
    const { err, filter } = makeFilter(`${LEGENDARY_CREATURE_FILTER} ${theme.filterText}`);
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
      `Synergy Connect puzzle for ${date} generated in ${Date.now() - start}ms after ${attempt} attempt(s): ${theme.kind} ${theme.filterText} — ${groups
        .map((group) => group.commander.name)
        .join(', ')}`,
    );

    return {
      theme: { filterText: theme.filterText, description: theme.description },
      groups,
      order,
    };
  }

  throw new Error(
    `Failed to generate a Synergy Connect puzzle for ${date} within ${MAX_GENERATION_ATTEMPTS} attempts (${Date.now() - start}ms)`,
  );
};
