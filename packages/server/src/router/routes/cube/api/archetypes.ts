import { listArchetypeProfile } from '@utils/drafting/topicArchetypes';
import { getReasonableCardByOracle } from 'serverutils/carddb';
import { getArchetypeData } from 'serverutils/modelPointer';
import { jsonLimiter } from 'serverutils/rateLimiters';
import { Request, Response } from 'types/express';

const MAX_ORACLES = 20000;

/**
 * POST /cube/api/archetypes
 *
 * Body: { oracles: string[] }, a cube's card list. Returns the archetypes the list supports, best
 * first, each with its share of the list's archetype topics and the cards that carry it most. null
 * when the served archetypes are the legacy cluster centers, which only classify whole decks.
 */
export const archetypesHandler = async (req: Request, res: Response) => {
  const { oracles } = req.body || {};
  if (
    !Array.isArray(oracles) ||
    oracles.length > MAX_ORACLES ||
    !oracles.every((oracle) => typeof oracle === 'string' && oracle.length <= 64)
  ) {
    return res.status(400).json({ error: 'Invalid oracles' });
  }

  const data = getArchetypeData();
  if (data.kind !== 'topics') {
    return res.status(200).json({ archetypes: null });
  }

  const archetypes = listArchetypeProfile(oracles, data.topics, data.names).map(({ label, share, topCards }) => ({
    label,
    share,
    topCards: topCards.map((oracleId) => ({ oracleId, name: getReasonableCardByOracle(oracleId).name })),
  }));
  return res.status(200).json({ archetypes });
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [jsonLimiter(60_000, 30), archetypesHandler],
  },
];
