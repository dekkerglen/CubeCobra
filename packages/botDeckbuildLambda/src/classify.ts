import { s3 } from '@server/dynamo/s3client';
import { type ArchetypeNamesFile, type ArchetypeTopicsFile, classifyByTopics } from '@utils/drafting/topicArchetypes';
import {
  ARCHETYPE_NAMES_FILE,
  ARCHETYPE_TOPICS_FILE,
  MODEL_POINTER_KEY,
  modelVersionPrefix,
  parseModelPointer,
} from '@utils/ml/modelBundle';

/**
 * Deck archetype classification for bot seats, with the archetype topics of the bundle the
 * environment serves (model/current.json -> model/<version>/archetypes/ in DATA_BUCKET, see
 * @utils/drafting/topicArchetypes). They are loaded once per cold start, like the servers load them
 * at boot, and classify from the cards alone. While the served bundle has none (the legacy v3),
 * decks get no archetype.
 */
type Archetypes = { topics: ArchetypeTopicsFile; names: ArchetypeNamesFile } | null;

// While the served bundle has no archetypes, the pointer is checked again after this long, so a
// newly promoted bundle's topics are picked up.
const RECHECK_MS = 5 * 60 * 1000;

let cached: { data: Archetypes; checkedAt: number } | null = null;

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
  if (!bucket) return null;
  const pointer = await readText(bucket, MODEL_POINTER_KEY);
  if (pointer === null) return null;

  const prefix = modelVersionPrefix(parseModelPointer(pointer).version);
  const [topics, names] = await Promise.all([
    readText(bucket, `${prefix}${ARCHETYPE_TOPICS_FILE}`),
    readText(bucket, `${prefix}${ARCHETYPE_NAMES_FILE}`),
  ]);
  if (topics === null || names === null) return null;
  return { topics: JSON.parse(topics), names: JSON.parse(names) };
};

const getArchetypes = async (): Promise<Archetypes> => {
  if (cached && (cached.data !== null || Date.now() - cached.checkedAt <= RECHECK_MS)) {
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
  if (!archetypes) return oracleIdsPerDeck.map(() => null);
  const { topics, names } = archetypes;
  return oracleIdsPerDeck.map((oracleIds) => classifyByTopics(oracleIds, topics, names));
};
