import Card, { CardDetails, DefaultPrintingPreference, PrintingPreference } from '@utils/datatypes/Card';
import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import { FeedTypes } from '@utils/datatypes/Feed';
import { blogDao, changelogDao, cubeDao, feedDao, userDao } from 'dynamo/daos';
import { ensureAuthJson } from 'router/middleware';
import carddb, {
  cardFromId,
  getMostReasonable,
  getReasonableCardByOracleWithPrintingPreference,
  getRelatedCards,
} from 'serverutils/carddb';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { recommend } from 'serverutils/ml';
import { newCard } from 'serverutils/util';

import { Request, Response } from '../../../../types/express';

const MAX_CUBE_SIZE = 1000;
const DEFAULT_CARD_COUNT = 180;

type ColorCode = 'W' | 'U' | 'B' | 'R' | 'G';
const ALL_COLORS: ColorCode[] = ['W', 'U', 'B', 'R', 'G'];

type Bucket = ColorCode | 'C' | 'M' | 'L';

const isValidPrinting = (value: unknown): value is PrintingPreference =>
  Object.values(PrintingPreference).includes(value as PrintingPreference);

const sanitizeIncludeColors = (raw: unknown): ColorCode[] => {
  if (!Array.isArray(raw)) {
    return [...ALL_COLORS];
  }
  const seen = new Set<ColorCode>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const upper = value.toUpperCase();
    if (ALL_COLORS.includes(upper as ColorCode)) {
      seen.add(upper as ColorCode);
    }
  }
  return Array.from(seen);
};

const MIN_RELEASE_DATE = '2000-01-01';

// Playtest sets (Mystery Booster Convention Edition + later batches, plus
// the various secret-event playtest set codes Gavin Verhey hands out at
// in-person events). Scryfall-tagged playtest cards are caught by the
// promo_types check; this is the explicit fallback for sets that aren't
// always tagged consistently.
const PLAYTEST_SETS = new Set(['cmb1', 'cmb2', 'pmei']);

const isUsableCard = (details: CardDetails | null | undefined): boolean => {
  if (!details || details.error) return false;
  if (details.isToken) return false;
  if (details.layout === 'art_series') return false;
  if (details.border_color === 'silver') return false;
  if (details.type?.includes('Basic') && details.type?.includes('Land')) return false;
  // Skip Mystery Booster / Gavin's secret-event playtest cards.
  if ((details.promo_types || []).includes('playtest')) return false;
  if (details.set && PLAYTEST_SETS.has(details.set.toLowerCase())) return false;
  return true;
};

/**
 * Returns true when at least one printing of this oracle id was released on or
 * after MIN_RELEASE_DATE. Used to keep the seed crystal from pulling in cards
 * that have effectively been out of print for decades.
 */
const hasModernPrinting = (oracleId: string): boolean => {
  const ids = carddb.oracleToId[oracleId];
  if (!ids || ids.length === 0) return false;
  for (const id of ids) {
    const card = cardFromId(id);
    if (!card || card.error) continue;
    if (card.released_at && card.released_at >= MIN_RELEASE_DATE) {
      return true;
    }
  }
  return false;
};

const bucketForCard = (details: CardDetails): Bucket => {
  if (details.type?.includes('Land')) return 'L';
  const cardColors = (details.colors || []).filter((c): c is ColorCode => ALL_COLORS.includes(c as ColorCode));
  if (cardColors.length === 0) return 'C';
  if (cardColors.length > 1) return 'M';
  return cardColors[0]!;
};

/**
 * For lands we use color identity (so e.g. Hallowed Fountain → WU); for
 * non-lands we use cast cost colors. Returns the sorted unique colors as
 * an array (e.g. ['U', 'W']).
 */
const distinctColorsOf = (details: CardDetails): ColorCode[] => {
  const isLand = details.type?.includes('Land');
  const raw = (isLand ? details.color_identity : details.colors) || [];
  const filtered = (raw as string[]).filter((c) => ALL_COLORS.includes(c as ColorCode)).map((c) => c as ColorCode);
  return Array.from(new Set(filtered)).sort();
};

const comboKey = (details: CardDetails, size: 2 | 3): string | null => {
  const unique = distinctColorsOf(details);
  if (unique.length === size) {
    return unique.join('');
  }
  return null;
};

/**
 * Seed crystal: given a single seed card, build out a cube of `cardCount`
 * cards by combining the seed's synergistic neighbours with ML-recommended
 * additions on top of that superset. Used by the empty-cube welcome card.
 */
export const seedCrystalHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({ success: 'false', message: 'Cube ID is required' });
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({ success: 'false', message: 'Cube not found' });
    }

    if (!req.user || !isCubeEditable(cube, req.user)) {
      return res.status(403).send({ success: 'false', message: 'Unauthorized' });
    }

    const {
      cardName,
      includeColors: rawIncludeColors,
      balanced: rawBalanced,
    } = req.body as {
      cardName?: string;
      includeColors?: unknown;
      balanced?: unknown;
    };

    let { cardCount } = req.body as {
      cardCount?: number | string;
    };
    const { printingPreference } = req.body as {
      printingPreference?: string;
    };

    if (!cardName || typeof cardName !== 'string' || !cardName.trim()) {
      return res.status(400).send({ success: 'false', message: 'cardName is required' });
    }

    cardCount = parseInt(String(cardCount ?? DEFAULT_CARD_COUNT), 10);
    if (!Number.isFinite(cardCount) || cardCount <= 0) {
      cardCount = DEFAULT_CARD_COUNT;
    }
    cardCount = Math.min(cardCount, MAX_CUBE_SIZE);

    const includeColors = sanitizeIncludeColors(rawIncludeColors);
    const balanced = rawBalanced === true || rawBalanced === 'true';

    const printing: PrintingPreference = isValidPrinting(printingPreference)
      ? printingPreference
      : ((req.user?.defaultPrinting as PrintingPreference) ?? DefaultPrintingPreference);

    // Resolve the seed card name → oracle id
    const seedCard = getMostReasonable(cardName.trim(), printing);
    if (!seedCard || !seedCard.oracle_id) {
      return res.status(400).send({
        success: 'false',
        message: `Could not find a card named "${cardName}".`,
      });
    }

    // Validate the seed card's colors are within the selected colors. We use
    // the cast-cost colors so a "Murderous Rider" (B) requires Black to be
    // included even though its color identity also contains Red etc.
    const seedColors = (seedCard.colors || []).filter((c): c is ColorCode => ALL_COLORS.includes(c as ColorCode));
    const missingFromSelection = seedColors.filter((c) => !includeColors.includes(c));
    if (missingFromSelection.length > 0) {
      return res.status(400).send({
        success: 'false',
        message: `The seed card "${seedCard.name}" requires ${missingFromSelection.join(', ')}, but you didn't include ${
          missingFromSelection.length > 1 ? 'those colors' : 'that color'
        }.`,
      });
    }

    if (!isUsableCard(seedCard)) {
      return res.status(400).send({
        success: 'false',
        message: 'The seed card must not be a token, art card, basic land, silver-bordered card, or playtest card.',
      });
    }

    if (!hasModernPrinting(seedCard.oracle_id)) {
      return res.status(400).send({
        success: 'false',
        message: `"${seedCard.name}" hasn't been printed since before 2000 — pick a more recent card.`,
      });
    }

    // Pull synergistic neighbours from the metadata dictionary
    const related = getRelatedCards(seedCard.oracle_id, printing);
    const synergistic = related.synergistic ?? {};
    const synergisticOracles: string[] = [];
    const synergisticSeen = new Set<string>([seedCard.oracle_id]);
    for (const bucket of ['top', 'creatures', 'spells', 'other'] as const) {
      for (const detail of synergistic[bucket] || []) {
        if (detail?.oracle_id && !synergisticSeen.has(detail.oracle_id)) {
          synergisticSeen.add(detail.oracle_id);
          synergisticOracles.push(detail.oracle_id);
        }
      }
    }

    // The superset is the seed plus everything it's synergistic with
    const superset = [seedCard.oracle_id, ...synergisticOracles];

    // Iteratively call the recommender, feeding each batch of picks back in as
    // context so the next call refines on the growing cube. Each call pulls in
    // at most ITERATION_BATCH_SIZE new oracles. We aim for ~2x cardCount worth
    // of candidates so the balanced/color-filtering logic below has headroom.
    const ITERATION_BATCH_SIZE = 100;
    const MAX_ITERATIONS = 25; // safety cap
    const CANDIDATE_HEADROOM = 2; // fetch 2x cardCount candidates before stopping

    const fillerOracles: string[] = [];
    const knownOracles = new Set<string>(superset);
    const recommenderContext: string[] = [...superset];
    const candidateTarget = cardCount * CANDIDATE_HEADROOM;
    let lastAdds: { oracle: string; rating: number }[] = [];

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      if (recommenderContext.length >= candidateTarget) break;

      const { adds } = await recommend(recommenderContext);
      lastAdds = adds;
      let addedThisIteration = 0;
      for (const add of adds) {
        if (addedThisIteration >= ITERATION_BATCH_SIZE) break;
        if (!add?.oracle) continue;
        if (knownOracles.has(add.oracle)) continue;
        knownOracles.add(add.oracle);
        fillerOracles.push(add.oracle);
        recommenderContext.push(add.oracle);
        addedThisIteration += 1;
      }

      // The recommender ran out of new picks; no point looping further.
      if (addedThisIteration === 0) break;
    }

    // Append the rest of the final recommend call's ranking to the candidate
    // pool. The top-N-per-iteration loop above heavily favors the seed's
    // archetype, which would starve off-archetype buckets in balanced mode
    // (e.g. green/colorless candidates when the seed is a Black creature).
    // Including the tail of the final, most-refined ranking gives every
    // bucket enough candidates to fill, while the top of that ranking is
    // already in fillerOracles in the right order.
    for (const add of lastAdds) {
      if (!add?.oracle) continue;
      if (knownOracles.has(add.oracle)) continue;
      knownOracles.add(add.oracle);
      fillerOracles.push(add.oracle);
    }

    // Combined candidate ranking: seed → synergistic → recommend filler.
    const orderedCandidates: string[] = [...superset, ...fillerOracles];

    // Materialize oracle ids → CardDetails, filtering out unusable cards
    // (tokens, art series, basics, silver-bordered, pre-2000) and excluded colors.
    const candidateDetails: CardDetails[] = [];
    const seenOracles = new Set<string>();
    for (const oracleId of orderedCandidates) {
      if (seenOracles.has(oracleId)) continue;
      seenOracles.add(oracleId);
      const ids = carddb.oracleToId[oracleId];
      if (!ids || ids.length === 0) continue;
      if (!hasModernPrinting(oracleId)) continue;
      const details = getReasonableCardByOracleWithPrintingPreference(oracleId, printing);
      if (!isUsableCard(details)) continue;
      // Don't try to inspect the underlying scryfall card again — the
      // catalog already gives us a CardDetails with isToken/layout.
      // For lands we filter by color_identity (so a Watery Grave is excluded
      // when Black isn't selected, even though its cast cost has no colors).
      // For non-lands we use the cast cost colors.
      const isLand = details.type?.includes('Land');
      const filterSource = isLand ? details.color_identity : details.colors;
      const colors = (filterSource || []).filter((c): c is ColorCode => ALL_COLORS.includes(c as ColorCode));
      // If the card uses any excluded color, skip it.
      if (colors.some((c) => !includeColors.includes(c))) continue;
      candidateDetails.push(details);
    }

    // Always include the seed first.
    const chosen: CardDetails[] = [];
    const chosenOracles = new Set<string>();
    if (candidateDetails[0] && candidateDetails[0].oracle_id === seedCard.oracle_id) {
      chosen.push(candidateDetails[0]);
      chosenOracles.add(candidateDetails[0].oracle_id);
    }

    if (balanced) {
      // 8 equal sections: each included color, plus colorless, multicolored, lands.
      const sectionKeys: Bucket[] = [...includeColors, 'C', 'M', 'L'];
      const totalSections = sectionKeys.length;
      const baseTarget = Math.floor(cardCount / totalSections);
      const remainder = cardCount - baseTarget * totalSections;
      const sectionTargets: Record<Bucket, number> = {} as Record<Bucket, number>;
      sectionKeys.forEach((key, i) => {
        sectionTargets[key] = baseTarget + (i < remainder ? 1 : 0);
      });

      // Within Multicolored / Lands, no single 2-color combination (e.g. WU,
      // BG) may exceed its scaled fraction of the section. The percentages
      // scale with the number of selected colors so e.g. a 3-color seed still
      // has room to fill its M/L sections (with 5 colors there are 10
      // two-color combos and we cap at 10% each = up to 100% of the section
      // by 2-color cards; with 3 colors there are 3 combos and we cap at
      // ~33% each so each combo can still meaningfully contribute).
      const numColors = includeColors.length;
      const numTwoColorCombos = (numColors * (numColors - 1)) / 2;
      const numThreeColorCombos = (numColors * (numColors - 1) * (numColors - 2)) / 6;
      const twoColorPct = numTwoColorCombos > 0 ? 1.0 / numTwoColorCombos : 0;
      const threeColorPct = numThreeColorCombos > 0 ? 0.5 / numThreeColorCombos : 0;
      const sectionTwoColorCaps: { M: number; L: number } = {
        M: Math.max(1, Math.floor(sectionTargets['M'] * twoColorPct)),
        L: Math.max(1, Math.floor(sectionTargets['L'] * twoColorPct)),
      };
      const sectionThreeColorCaps: { M: number; L: number } = {
        M: Math.max(1, Math.floor(sectionTargets['M'] * threeColorPct)),
        L: Math.max(1, Math.floor(sectionTargets['L'] * threeColorPct)),
      };
      const sectionTwoColorCounts: { M: Record<string, number>; L: Record<string, number> } = {
        M: {},
        L: {},
      };
      const sectionThreeColorCounts: { M: Record<string, number>; L: Record<string, number> } = {
        M: {},
        L: {},
      };
      // Combined cap on "low-color" lands (color identity 0 or 1) so a cube
      // built from the seed crystal favors dual / tri-color / fetch lands over
      // basics and mono-color utility lands. Replaces the previous separate
      // caps for colorless-only and per-mono-color.
      const landsLowColorCap = Math.max(1, Math.floor(sectionTargets['L'] * 0.3));
      let landsLowColorCount = 0;
      const isCappedBucket = (b: Bucket): b is 'M' | 'L' => b === 'M' || b === 'L';

      // Pre-bucket all candidates while preserving rank.
      const bucketed: Record<Bucket, CardDetails[]> = {} as Record<Bucket, CardDetails[]>;
      sectionKeys.forEach((k) => {
        bucketed[k] = [];
      });
      for (const detail of candidateDetails) {
        const b = bucketForCard(detail);
        if (!sectionKeys.includes(b)) continue;
        bucketed[b].push(detail);
      }

      // The seed already counts toward its own bucket if we pushed it above.
      const sectionFilled: Record<Bucket, number> = {} as Record<Bucket, number>;
      sectionKeys.forEach((k) => {
        sectionFilled[k] = 0;
      });
      // A "low-color" land is one whose color identity is 0 or 1 colors —
      // basics, fetches, utility lands, and mono-color lands all qualify.
      const isLowColorLand = (detail: CardDetails) =>
        bucketForCard(detail) === 'L' && distinctColorsOf(detail).length <= 1;

      if (chosen.length === 1) {
        const seedDetail = chosen[0]!;
        const seedBucket = bucketForCard(seedDetail);
        if (sectionKeys.includes(seedBucket)) {
          sectionFilled[seedBucket] = 1;
        }
        if (isCappedBucket(seedBucket)) {
          const tc = comboKey(seedDetail, 2);
          if (tc) {
            sectionTwoColorCounts[seedBucket][tc] = 1;
          }
          const th = comboKey(seedDetail, 3);
          if (th) {
            sectionThreeColorCounts[seedBucket][th] = 1;
          }
        }
        if (isLowColorLand(seedDetail)) {
          landsLowColorCount = 1;
        }
      }

      const tryAddToBalancedSection = (detail: CardDetails, key: Bucket): boolean => {
        if (chosenOracles.has(detail.oracle_id)) return false;
        if (sectionFilled[key] >= sectionTargets[key]) return false;
        const lowColorLand = key === 'L' && isLowColorLand(detail);
        if (lowColorLand && landsLowColorCount >= landsLowColorCap) return false;
        if (isCappedBucket(key)) {
          const tc = comboKey(detail, 2);
          if (tc) {
            const counts = sectionTwoColorCounts[key];
            const used = counts[tc] || 0;
            if (used >= sectionTwoColorCaps[key]) return false;
          }
          const th = comboKey(detail, 3);
          if (th) {
            const counts = sectionThreeColorCounts[key];
            const used = counts[th] || 0;
            if (used >= sectionThreeColorCaps[key]) return false;
          }
          // Reserve the slots only after both checks pass so we don't
          // half-increment counters on a rejected card.
          if (tc) {
            const counts = sectionTwoColorCounts[key];
            counts[tc] = (counts[tc] || 0) + 1;
          }
          if (th) {
            const counts = sectionThreeColorCounts[key];
            counts[th] = (counts[th] || 0) + 1;
          }
        }
        if (lowColorLand) {
          landsLowColorCount += 1;
        }
        chosen.push(detail);
        chosenOracles.add(detail.oracle_id);
        sectionFilled[key] += 1;
        return true;
      };

      for (const key of sectionKeys) {
        for (const detail of bucketed[key]) {
          if (sectionFilled[key] >= sectionTargets[key]) break;
          tryAddToBalancedSection(detail, key);
        }
      }

      // Per-bucket targets and 2-color caps are strict — if a section can't
      // fill (e.g. you only included one color, or the recommender ran out of
      // unique non-capped cards), the cube ends up smaller than cardCount
      // rather than stuffed with off-balance cards.
    } else {
      for (const detail of candidateDetails) {
        if (chosen.length >= cardCount) break;
        if (chosenOracles.has(detail.oracle_id)) continue;
        chosen.push(detail);
        chosenOracles.add(detail.oracle_id);
      }
    }

    // Build cube cards from the chosen details.
    const builtCards: Card[] = chosen.map((details) => {
      const built = newCard(details, [], cube.defaultStatus || 'Not Owned');
      // newCard returns addedTmsp as a Date for legacy reasons; the Card type
      // wants a string. Normalize here so we keep strict types happy.
      return {
        ...built,
        addedTmsp: new Date().valueOf().toString(),
      } as Card;
    });

    if (builtCards.length === 0) {
      return res.status(500).send({
        success: 'false',
        message: 'Failed to build a cube from this seed crystal — try a different card.',
      });
    }

    // Append to the cube's mainboard (preserves anything that may already be there).
    const cubeCards = await cubeDao.getCards(req.params.id);
    if (!cubeCards.mainboard) {
      cubeCards.mainboard = [];
    }
    cubeCards.mainboard.push(...builtCards);

    await cubeDao.updateCards(req.params.id, cubeCards);

    let changelistId: string | undefined;
    try {
      changelistId = await changelogDao.createChangelog({ mainboard: { adds: builtCards } }, req.params.id);
    } catch (err) {
      // Changelog failure shouldn't fail the whole flow — the cube is already updated.
      req.logger.error((err as Error).message, (err as Error).stack);
    }

    // Auto-create a blog post announcing the seed crystal generation.
    try {
      const colorBlurb = balanced
        ? ` (balanced across ${includeColors.join('')}, colorless, multicolored, and lands)`
        : includeColors.length === ALL_COLORS.length
          ? ''
          : ` (limited to ${includeColors.join('')})`;
      const blogId = await blogDao.createBlog({
        owner: req.user.id,
        cube: cube.id,
        title: `Generated using ${seedCard.name} as a seed crystal`,
        body: `This cube was generated using [[${seedCard.name}]] as a seed crystal${colorBlurb}. ${builtCards.length} cards were added by combining synergistic neighbours with ML-recommended fillers.`,
        changelist: changelistId,
      });

      // Only publish to follower feeds if the cube is public.
      if (cube.visibility === CUBE_VISIBILITY.PUBLIC && blogId) {
        const [cubeLikers, userFollowers] = await Promise.all([
          cubeDao.getAllLikers(cube.id),
          userDao.getAllFollowers(req.user.id),
        ]);
        const followers = [...new Set([...userFollowers, ...cubeLikers])];
        const feedItems = followers.map((u) => ({
          id: blogId,
          to: u,
          date: new Date().valueOf(),
          type: FeedTypes.BLOG,
        }));
        if (feedItems.length > 0) {
          await feedDao.batchPutUnhydrated(feedItems);
        }
      }
    } catch (err) {
      req.logger.error((err as Error).message, (err as Error).stack);
    }

    return res.status(200).send({
      success: 'true',
      addedCount: builtCards.length,
      seedOracle: seedCard.oracle_id,
      seedName: seedCard.name,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: `Failed to build cube from seed crystal: ${error.message}`,
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [ensureAuthJson, seedCrystalHandler],
  },
];
