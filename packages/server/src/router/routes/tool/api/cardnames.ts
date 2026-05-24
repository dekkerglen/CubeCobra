import { normalizeName } from '@utils/cardutil';
import catalog from 'serverutils/cardCatalog';
import { prefixMatches } from 'serverutils/util';

import { Request, Response } from '../../../../types/express';

// Minimum prefix length before we run a query. Shorter prefixes match an
// unhelpfully large slice of the catalog, so the client suppresses them too.
const MIN_QUERY_LENGTH = 3;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 25;

// Card-name autocomplete. Matching runs server-side against the in-memory
// sorted name arrays (binary-search prefix scan); only the top N suggestions
// cross the wire — the catalog itself never ships to the browser.
export const cardNamesHandler = async (req: Request, res: Response) => {
  try {
    const raw = typeof req.query.q === 'string' ? req.query.q : '';
    const full = req.query.full === '1' || req.query.full === 'true';

    let limit = DEFAULT_LIMIT;
    if (typeof req.query.limit === 'string') {
      const parsed = parseInt(req.query.limit, 10);
      if (!Number.isNaN(parsed)) {
        limit = Math.min(Math.max(parsed, 1), MAX_LIMIT);
      }
    }

    const query = normalizeName(raw);
    if (query.length < MIN_QUERY_LENGTH) {
      return res.status(200).send({ success: 'true', names: [] });
    }

    const includeExtras = req.query.extras === '1' || req.query.extras === 'true';

    let source: string[];
    if (full && includeExtras) {
      source = catalog.full_names;
    } else if (full) {
      source = catalog.reasonable_full_names;
    } else if (includeExtras) {
      source = catalog.cardnames;
    } else {
      source = catalog.reasonable_names;
    }

    const names = prefixMatches(source, query, limit);

    return res.status(200).send({ success: 'true', names });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving card names',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [cardNamesHandler],
  },
];
