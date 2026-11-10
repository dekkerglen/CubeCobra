import { s3 } from '@server/dynamo/s3client';
import { archetypeForEmbedding, type ClusterCenter } from '@utils/drafting/archetype';
import { type ArchetypeNamesFile, type ArchetypeTopicsFile, classifyByTopics } from '@utils/drafting/topicArchetypes';
import {
  ARCHETYPE_NAMES_FILE,
  ARCHETYPE_TOPICS_FILE,
  MODEL_POINTER_KEY,
  modelVersionPrefix,
  parseModelPointer,
} from '@utils/ml/modelBundle';
import fs from 'fs';
import path from 'path';

import { batchEncode } from './ml';

/**
 * Deck archetype classification for bot seats, with the archetypes of the bundle the environment
 * serves (model/current.json -> model/<version>/archetypes/ in DATA_BUCKET):
 *  - archetype topics over oracle tags (@utils/drafting/topicArchetypes), loaded once per cold start
 *    like the servers load them at boot; they classify from the cards alone.
 *  - for the legacy v3 bundle, which has none, the static embedding cluster centers copied next to
 *    the bundle (see esbuild.config.js). Those are positions in v3's encoder space; the decks are
 *    encoded with one batched /batchencode call.
 */
type Archetypes =
  | { kind: 'topics'; topics: ArchetypeTopicsFile; names: ArchetypeNamesFile }
  | { kind: 'centers'; version: string | null; centers: ClusterCenter[]; annotations: Record<string, string> };

// The recommender hot-swaps its encoder on promotion, so while the legacy centers are in use the
// pointer is checked again after this long; a newly promoted bundle's topics replace them.
const CENTERS_RECHECK_MS = 5 * 60 * 1000;

let bundled: { centers: ClusterCenter[]; annotations: Record<string, string> } | null = null;
let cached: { data: Archetypes; checkedAt: number } | null = null;

const loadBundled = (version: string | null): Archetypes => {
  if (!bundled) {
    bundled = { centers: [], annotations: {} };
    try {
      const centersPath = path.join(__dirname, 'clusterCenters.json');
      const annotationsPath = path.join(__dirname, 'annotations.json');
      if (fs.existsSync(centersPath)) bundled.centers = JSON.parse(fs.readFileSync(centersPath, 'utf8'));
      if (fs.existsSync(annotationsPath)) bundled.annotations = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
    } catch (err) {
      console.warn('bot-deckbuild: failed to load bundled archetype data', err);
    }
  }
  return { kind: 'centers', version, ...bundled };
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

// Other S3 failures throw, so a flaky read never swaps in the wrong archetypes.
const loadArchetypes = async (): Promise<Archetypes> => {
  const bucket = process.env.DATA_BUCKET;
  if (!bucket) return loadBundled(null);
  const pointer = await readText(bucket, MODEL_POINTER_KEY);
  if (pointer === null) return loadBundled(null);

  const { version } = parseModelPointer(pointer);
  if (cached?.data.kind === 'centers' && cached.data.version === version) return cached.data;

  const prefix = modelVersionPrefix(version);
  const [topics, names] = await Promise.all([
    readText(bucket, `${prefix}${ARCHETYPE_TOPICS_FILE}`),
    readText(bucket, `${prefix}${ARCHETYPE_NAMES_FILE}`),
  ]);
  if (topics === null || names === null) return loadBundled(version);
  return { kind: 'topics', topics: JSON.parse(topics), names: JSON.parse(names) };
};

const getArchetypes = async (): Promise<Archetypes> => {
  if (cached && (cached.data.kind === 'topics' || Date.now() - cached.checkedAt <= CENTERS_RECHECK_MS)) {
    return cached.data;
  }
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
 */
export const classifyDecks = async (oracleIdsPerDeck: string[][]): Promise<(string | null)[]> => {
  let archetypes: Archetypes;
  try {
    archetypes = await getArchetypes();
  } catch (err) {
    // Unlabeled this batch; the next one reads S3 again.
    console.warn('bot-deckbuild: failed to load archetype data', err);
    return oracleIdsPerDeck.map(() => null);
  }

  if (archetypes.kind === 'topics') {
    const { topics, names } = archetypes;
    return oracleIdsPerDeck.map((oracleIds) => classifyByTopics(oracleIds, topics, names));
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
