import { s3 } from '@server/dynamo/s3client';
import { archetypeForEmbedding, type ClusterCenter } from '@utils/drafting/archetype';
import {
  ARCHETYPE_ANNOTATIONS_FILE,
  ARCHETYPE_CENTERS_FILE,
  MODEL_POINTER_KEY,
  modelVersionPrefix,
  parseModelPointer,
} from '@utils/ml/modelBundle';
import fs from 'fs';
import path from 'path';

import { batchEncode } from './ml';

/**
 * Deck archetype classification for bot seats. Cluster centers are positions in one model's
 * embedding space, so they come from the bundle the environment serves (model/current.json ->
 * model/<version>/archetypes/ in DATA_BUCKET), falling back to the static files copied next to the
 * bundle (see esbuild.config.js) when there is no pointer or the bundle has none (the legacy v3).
 * The nearest-cluster math is shared with the server via @utils/drafting/archetype. Encoding is
 * batched so a whole SQS batch of decks costs one /batchencode call rather than one /encode per seat.
 */
interface ArchetypeData {
  version: string | null;
  centers: ClusterCenter[];
  annotations: Record<string, string>;
}

// The container can outlive a promotion, so the pointer is checked again after this long.
const POINTER_TTL_MS = 5 * 60 * 1000;

let bundled: ArchetypeData | null = null;
let cached: { data: ArchetypeData; checkedAt: number } | null = null;

const loadBundled = (): ArchetypeData => {
  if (!bundled) {
    bundled = { version: null, centers: [], annotations: {} };
    try {
      const centersPath = path.join(__dirname, 'clusterCenters.json');
      const annotationsPath = path.join(__dirname, 'annotations.json');
      if (fs.existsSync(centersPath)) bundled.centers = JSON.parse(fs.readFileSync(centersPath, 'utf8'));
      if (fs.existsSync(annotationsPath)) bundled.annotations = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
    } catch (err) {
      console.warn('bot-deckbuild: failed to load bundled archetype data', err);
    }
  }
  return bundled;
};

// Without s3:ListBucket a missing key reads as AccessDenied rather than NoSuchKey.
const isMissingObject = (err: unknown): boolean => {
  const { name, $metadata } = (err ?? {}) as { name?: string; $metadata?: { httpStatusCode?: number } };
  const status = $metadata?.httpStatusCode;
  return name === 'NoSuchKey' || name === 'NotFound' || name === 'AccessDenied' || status === 404 || status === 403;
};

const readText = async (bucket: string, key: string): Promise<string | null> => {
  try {
    const res = await s3.getObject({ Bucket: bucket, Key: key });
    return (await res.Body?.transformToString()) ?? null;
  } catch (err) {
    if (isMissingObject(err)) return null;
    throw err;
  }
};

// Other S3 failures throw, so a flaky read never swaps in the wrong model's centers.
const loadArchetypes = async (): Promise<ArchetypeData> => {
  const bucket = process.env.DATA_BUCKET;
  if (!bucket) return loadBundled();
  const pointer = await readText(bucket, MODEL_POINTER_KEY);
  if (pointer === null) return loadBundled();

  const { version } = parseModelPointer(pointer);
  if (cached && cached.data.version === version) return cached.data;

  const prefix = modelVersionPrefix(version);
  const [centers, annotations] = await Promise.all([
    readText(bucket, `${prefix}${ARCHETYPE_CENTERS_FILE}`),
    readText(bucket, `${prefix}${ARCHETYPE_ANNOTATIONS_FILE}`),
  ]);
  if (centers === null || annotations === null) return loadBundled();
  return { version, centers: JSON.parse(centers), annotations: JSON.parse(annotations) };
};

const getArchetypes = async (): Promise<ArchetypeData> => {
  if (cached && Date.now() - cached.checkedAt <= POINTER_TTL_MS) return cached.data;
  try {
    cached = { data: await loadArchetypes(), checkedAt: Date.now() };
  } catch (err) {
    if (!cached) throw err;
    // Keep what this container already had; the next batch reads S3 again.
    console.warn('bot-deckbuild: could not re-check the model pointer', err);
  }
  return cached.data;
};

/**
 * Classify many decks at once. Returns an archetype label (or null) per input deck, in order.
 * A single batched /encode call covers every deck.
 */
export const classifyDecks = async (oracleIdsPerDeck: string[][]): Promise<(string | null)[]> => {
  let archetypes: ArchetypeData;
  try {
    archetypes = await getArchetypes();
  } catch (err) {
    // Unlabeled this batch; the next one reads S3 again.
    console.warn('bot-deckbuild: failed to load archetype data', err);
    return oracleIdsPerDeck.map(() => null);
  }
  const { centers, annotations } = archetypes;
  if (centers.length === 0) return oracleIdsPerDeck.map(() => null);

  try {
    const embeddings = await batchEncode(oracleIdsPerDeck);
    return oracleIdsPerDeck.map((oracleIds, i) =>
      oracleIds.length === 0 ? null : archetypeForEmbedding(embeddings[i], centers, annotations),
    );
  } catch {
    return oracleIdsPerDeck.map(() => null);
  }
};
