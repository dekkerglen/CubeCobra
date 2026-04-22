import fs from 'fs';
import path from 'path';

import { Request, Response } from '../../../types/express';

const STATIC_DIR = path.join(__dirname, '..', '..', '..', 'static');

let cached: { centers: { clusterId: number; center: number[] }[]; annotations: Record<string, string> } | null = null;

/**
 * GET /api/archetypes
 *
 * Returns the precomputed cluster centers and human-readable archetype labels.
 * Clients use their pool embeddings to find the nearest center via cosine similarity.
 * Response is cached in memory after first load.
 */
const archetypesHandler = (_req: Request, res: Response) => {
  if (!cached) {
    try {
      const centers = JSON.parse(fs.readFileSync(path.join(STATIC_DIR, 'clusterCenters.json'), 'utf8'));
      const annotations = JSON.parse(fs.readFileSync(path.join(STATIC_DIR, 'annotations.json'), 'utf8'));
      cached = { centers, annotations };
    } catch {
      return res.status(503).json({ error: 'Archetype data not available' });
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.json(cached);
};

export const routes = [{ method: 'get', path: '/', handler: [archetypesHandler] }];
