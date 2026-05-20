import { typeIsSpecialZoneType } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import { makeFilter } from '@utils/filtering/FilterCards';
import { cubeDao } from 'dynamo/daos';
import { cardFromId, getAllMostReasonable } from 'serverutils/carddb';
import { recommendOrThrow } from 'serverutils/ml';

import { Request, Response } from '../../../../types/express';

// Set codes for the Mystery Booster playtest cards (Gavin Verhey's "mystery
// event" / convention playtest cards). These aren't real, tournament-playable
// cards and shouldn't be suggested as cube additions.
const MYSTERY_PLAYTEST_SETS = new Set(['cmb1', 'cmb2']);

// Smart Search suggests cards to ADD to a cube, so it should never surface
// cards that can't sit in a normal cube list. Tokens are already dropped
// upstream (printedCardList excludes them); here we also drop basic lands,
// special-zone cards (planes, schemes, phenomena, vanguards, conspiracies,
// contraptions), and Mystery Booster playtest cards.
const isExcludedFromSmartSearch = (card: CardDetails): boolean => {
  const type = card.type ?? '';
  if (type.includes('Basic') && type.includes('Land')) return true;
  if (typeIsSpecialZoneType(type)) return true;
  if (card.set && MYSTERY_PLAYTEST_SETS.has(card.set.toLowerCase())) return true;
  return false;
};

export const addsHandler = async (req: Request, res: Response) => {
  try {
    let { skip, limit } = req.body;
    const { cubeID, filterText, printingPreference } = req.body;

    if (!cubeID) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
        cardIDs: [],
        hasMoreAdds: false,
      });
    }

    limit = parseInt(limit, 10);
    skip = parseInt(skip, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 96;
    if (!Number.isFinite(skip) || skip < 0) skip = 0;

    // Smart Search is filter-driven. With no filter there is nothing to rank,
    // so return empty instead of dumping the whole recommender list.
    if (!filterText || `${filterText}`.trim().length === 0) {
      return res.status(200).send({ cardIDs: [], hasMoreAdds: false });
    }

    const { err, filter } = makeFilter(`${filterText}`);
    if (err || !filter) {
      return res.status(400).send({
        success: 'false',
        cardIDs: [],
        hasMoreAdds: false,
      });
    }

    // The cube's own cards. Fetched concurrently with the (synchronous) catalog
    // filter below; needed so we can exclude cards already in the cube from the
    // suggestions, and to give the model cube context.
    const cubeCardsPromise = cubeDao.getCards(cubeID, undefined, { populate: false });

    // Apply the user's filter to the whole catalog here on the server — it has
    // the card catalog and filter module. getAllMostReasonable already drops
    // tokens; isExcludedFromSmartSearch drops basics, special-zone cards, and
    // Mystery Booster playtest cards. Each eligible oracle maps to one
    // displayable (printing-preferred) card.
    const eligible = getAllMostReasonable(filter, printingPreference);
    const eligibleByOracle = new Map<string, CardDetails>();
    for (const card of eligible) {
      const oracleId = card.oracle_id;
      if (!oracleId || eligibleByOracle.has(oracleId)) continue;
      if (isExcludedFromSmartSearch(card)) continue;
      eligibleByOracle.set(oracleId, card);
    }

    const eligibleOracles = [...eligibleByOracle.keys()];

    // Filter matched nothing — skip the ML round trip entirely.
    if (eligibleOracles.length === 0) {
      return res.status(200).send({ cardIDs: [], hasMoreAdds: false });
    }

    const cubeCards = await cubeCardsPromise;
    const cubeOracles = cubeCards.mainboard
      .map((card: any) => cardFromId(card.cardID)?.oracle_id)
      .filter((id: any): id is string => Boolean(id));

    // The recommender ranks the eligible oracles by fit and returns just the
    // requested page plus the total. We pass oracle ids, not ML indices: the
    // oracle<->index mapping lives entirely inside the recommender, so the two
    // services never need a shared index table (a mismatch there would corrupt
    // every rating). recommendOrThrow throws on ML failure so we can surface a
    // real 503 instead of silently degrading to filter order.
    let result: Awaited<ReturnType<typeof recommendOrThrow>>;
    try {
      result = await recommendOrThrow(cubeOracles, { eligibleOracles, skip, limit });
    } catch (mlErr) {
      const error = mlErr as Error;
      req.logger.error('Smart Search recommender call failed', error.stack ?? error.message);
      return res.status(503).send({
        success: 'false',
        mlUnavailable: true,
        message:
          'The card recommender is temporarily unavailable, so Smart Search results would be unranked. Please try again in a moment.',
        cardIDs: [],
        hasMoreAdds: false,
      });
    }

    // result.adds is the requested page of ranked oracle ids (cube cards and
    // unrankable cards already handled by the recommender). Map each back to
    // its displayable card via eligibleByOracle — every returned oracle is one
    // we sent, so nothing can be dropped here. The client resolves full
    // details from its IndexedDB cache (utils/cardDetailsCache), batching
    // misses through /cube/api/getdetailsforcards.
    const cardIDs = result.adds
      .map((item) => eligibleByOracle.get(item.oracle)?.scryfall_id)
      .filter((id): id is string => Boolean(id));

    return res.status(200).send({
      cardIDs,
      hasMoreAdds: skip + limit < result.totalAdds,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving recommendations',
      cardIDs: [],
      hasMoreAdds: false,
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [addsHandler],
  },
];
