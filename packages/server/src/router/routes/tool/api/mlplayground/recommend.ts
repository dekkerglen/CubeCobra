import { CardDetails } from '@utils/datatypes/Card';
import { makeFilter, MAX_SEARCH_FILTER_LENGTH } from '@utils/filtering/FilterCards';
import catalog from 'serverutils/cardCatalog';
import { getAllMostReasonable } from 'serverutils/carddb';
import {
  ListInputError,
  modelOracles,
  playgroundPrinting,
  ratePastedCards,
  resolveList,
  sendPlaygroundError,
  summarize,
} from 'serverutils/mlPlayground';
import { recommendOrThrow } from 'serverutils/ml';
import { budgetRegexFilter, FilterTimeoutError } from 'serverutils/filterBudget';
import { jsonLimiter, regexFilterLimiter } from 'serverutils/rateLimiters';
import { isExcludedFromSmartSearch } from 'serverutils/smartSearch';
import { applyUniversesBeyondSetting } from 'serverutils/universesBeyond';

import { Request, Response } from '../../../../../types/express';

const DEFAULT_LIMIT = 96;
const MAX_LIMIT = 200;
// Grow sends the cards it has added so far as extra context, as oracle ids.
const MAX_EXTRA_ORACLES = 2000;
const ORACLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Smart Search over a pasted list: ranks the cards matching the filter (every card, with no
 * filter) by how well the cube_decoder thinks they fit the list, and ranks the list's own cards
 * worst fit first.
 *
 * Body: { cards, filterText?, skip?, limit?, substitute?, extra?, brief? }
 *   substitute - give the model stand-ins for cards it doesn't know. Off by default, as in Smart
 *                Search, which sends a cube's cards as they are.
 *   extra      - oracle ids added to the context (the cards Grow has picked so far).
 *   brief      - leave out the list and the cuts; Grow only needs the next adds.
 */
export const recommendHandler = async (req: Request, res: Response) => {
  try {
    const { filterText } = req.body;
    const substitute = req.body.substitute === true;
    const brief = req.body.brief === true;

    let skip = parseInt(req.body.skip, 10);
    let limit = parseInt(req.body.limit, 10);
    if (!Number.isFinite(skip) || skip < 0) skip = 0;
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);

    const rawExtra: unknown = req.body.extra;
    if (rawExtra !== undefined && (!Array.isArray(rawExtra) || rawExtra.length > MAX_EXTRA_ORACLES)) {
      throw new ListInputError('Too many cards.');
    }
    const extra = ((rawExtra as unknown[] | undefined) ?? []).filter(
      (oracle): oracle is string => typeof oracle === 'string' && ORACLE_ID.test(oracle),
    );

    const printing = playgroundPrinting(req);
    const list = resolveList(req.body.cards, { substitute, printing });

    const text = typeof filterText === 'string' ? filterText.trim() : '';
    let filter = null;
    if (text.length > 0) {
      const parsed = text.length > MAX_SEARCH_FILTER_LENGTH ? { err: true, filter: null } : makeFilter(text);
      if (parsed.err || !parsed.filter) {
        return res.status(400).json({ success: false, message: 'Invalid filter.' });
      }
      filter = parsed.filter;
    }

    // Same candidate pool as Smart Search: one printing per oracle, no tokens, basics or
    // playtest cards.
    const eligibleByOracle = new Map<string, CardDetails>();
    for (const card of getAllMostReasonable(
      applyUniversesBeyondSetting(budgetRegexFilter(filter), req.user, text)!,
      printing,
    )) {
      const oracle = card.oracle_id;
      if (!oracle || eligibleByOracle.has(oracle)) continue;
      if (isExcludedFromSmartSearch(card)) continue;
      eligibleByOracle.set(oracle, card);
    }

    const context = [...new Set([...modelOracles(list), ...extra])];
    const eligibleOracles = [...eligibleByOracle.keys()];

    if (eligibleOracles.length === 0 && (brief || list.cards.length === 0)) {
      return res.status(200).json({
        success: true,
        ...(brief ? {} : { list: summarize(list), cuts: [] }),
        adds: [],
        totalAdds: 0,
      });
    }

    const result = await recommendOrThrow(context, { eligibleOracles, skip, limit });

    // The recommender ranks the cards it can't score last, at 0. Flag them so the page doesn't
    // read that as a real score.
    const adds = result.adds.flatMap((item) => {
      const card = eligibleByOracle.get(item.oracle);
      if (!card) return [];
      const known = catalog.oracleToIndex[item.oracle] !== undefined;
      return [{ cardID: card.scryfall_id, oracle: item.oracle, name: card.name, rating: known ? item.rating : null }];
    });

    return res.status(200).json({
      success: true,
      ...(brief ? {} : { list: summarize(list), cuts: ratePastedCards(list, result.cuts, false) }),
      adds,
      totalAdds: result.totalAdds,
    });
  } catch (err) {
    if (err instanceof FilterTimeoutError) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return sendPlaygroundError(req, res, err, 'ML Playground recommend');
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    // Grow calls this once per step, so allow more than Smart Search's 60 a minute.
    handler: [jsonLimiter(60_000, 120), regexFilterLimiter((req) => req.body?.filterText), recommendHandler],
  },
];
