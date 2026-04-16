import catalog from 'serverutils/cardCatalog';

import { Request, Response } from '../../../../types/express';

/**
 * Serves Scryfall tag data for client-side filter and sort lookups.
 * Uses aggressive caching (1 week) since tag data changes infrequently.
 */
export const tagsHandler = async (_req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400'); // 1 week cache, 1 day stale
    res.status(200).json({
      success: 'true',
      oracleTagDict: catalog.oracleTagDict,
      oracleTagNames: catalog.oracleTagNames,
      illustrationTagDict: catalog.illustrationTagDict,
      illustrationTagNames: catalog.illustrationTagNames,
      oracleToIndex: catalog.oracleToIndex,
      scryfallIdToIndex: catalog.scryfallIdToIndex,
    });
  } catch (err) {
    const error = err as Error;
    _req.logger.error(error.message, error.stack);
    res.status(500).json({
      success: 'false',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: tagsHandler,
  },
];
