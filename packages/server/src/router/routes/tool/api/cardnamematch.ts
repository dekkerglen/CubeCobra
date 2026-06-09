import { normalizeName } from '@utils/cardutil';
import { scoreMatch } from '@utils/fuzzyCardMatch';
import catalog from 'serverutils/cardCatalog';
import { normalizeAlpha, substringMatches } from 'serverutils/cardNameSearch';
import { prefixMatches } from 'serverutils/util';

import { Request, Response } from '../../../../types/express';

const MIN_QUERY_LENGTH = 3;
const SHORTLIST = 25;

// Best fuzzy match for a (noisy, OCR'd) card name against the FULL catalog.
// Used by the photo scanner to re-check low-confidence cube matches — an old
// photo may contain cards that have since been cut from the cube. We generate a
// small candidate shortlist with the same indexed prefix/substring search the
// autocomplete uses, then score it with the shared fuzzy matcher so the score is
// directly comparable to the client's cube-pool match. Only the query string is
// sent; the catalog never ships to the browser.
export const cardNameMatchHandler = async (req: Request, res: Response) => {
  try {
    const raw = typeof req.query.q === 'string' ? req.query.q : '';
    const query = normalizeName(raw);
    if (query.length < MIN_QUERY_LENGTH) {
      return res.status(200).send({ success: 'true', match: null });
    }

    const source = catalog.reasonable_names;
    const candidates = prefixMatches(source, query, SHORTLIST);
    if (candidates.length < SHORTLIST) {
      const alphaNeedle = normalizeAlpha(raw);
      if (alphaNeedle.length >= MIN_QUERY_LENGTH) {
        candidates.push(...substringMatches(source, alphaNeedle, SHORTLIST - candidates.length, new Set(candidates)));
      }
    }

    let best: { name: string; score: number } | null = null;
    for (const name of candidates) {
      const score = scoreMatch(raw, name);
      if (!best || score > best.score) {
        best = { name, score };
      }
    }

    return res.status(200).send({ success: 'true', match: best });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({ success: 'false', message: 'Error matching card name' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [cardNameMatchHandler],
  },
];
