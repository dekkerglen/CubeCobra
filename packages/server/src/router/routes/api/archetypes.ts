import { getArchetypeData, getServedModelVersion } from 'serverutils/modelPointer';

import { Request, Response } from '../../../types/express';

/**
 * GET /api/archetypes
 *
 * Returns the cluster centers and human-readable archetype labels for the served model version.
 * Clients use their pool embeddings to find the nearest center via cosine similarity, so they ask
 * with ?v=<their model version>; the URL changes with each promotion and can be cached for a day.
 */
const archetypesHandler = (req: Request, res: Response) => {
  const { centers, annotations } = getArchetypeData();
  if (centers.length === 0) {
    return res.status(503).json({ error: 'Archetype data not available' });
  }

  const modelVersion = getServedModelVersion();
  // A server that hasn't picked up a promotion yet must not let a cache keep its old centers under
  // the new version's URL.
  const requested = req.query.v;
  const cacheable = requested === undefined || requested === modelVersion;
  res.setHeader('Cache-Control', cacheable ? 'public, max-age=86400' : 'no-store');
  return res.json({ centers, annotations, modelVersion });
};

export const routes = [{ method: 'get', path: '/', handler: [archetypesHandler] }];
