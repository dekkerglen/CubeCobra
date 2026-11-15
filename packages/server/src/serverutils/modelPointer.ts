/**
 * The ML model version this environment serves, per model/current.json in DATA_BUCKET, and the
 * archetype data that goes with it.
 *
 * The pointer is read once at boot and then every five minutes (startModelPointerRefresh), so the
 * browser's model version follows a promotion or rollback without a deploy. Until the first read
 * succeeds, and whenever S3 can't be reached, the last known version stays in place (initially the
 * legacy v3).
 *
 * Archetypes are read once at boot from the served bundle: archetype topics over oracle tags
 * (archetypes/topics.json + names.json, see @utils/drafting/topicArchetypes) and kept in memory, so
 * an admin's renames and a newly promoted version's topics reach the site on the next restart. The
 * legacy v3 bundle has none, so while it is served decks get no archetype, and the archetypes are
 * read again whenever the served version changes.
 *
 * The served model's vocabulary (the oracles in its indexToOracleMap.json) is read whenever the
 * served version changes, so getOracleForMl only stands in a similar card for cards that model
 * wasn't trained on. The metadata dict's stand-ins are rebuilt weekly against whatever model was
 * served then, so they go stale when a model is promoted or rolled back in between.
 */
import type { ArchetypeNamesFile, ArchetypeTopicsFile } from '@utils/drafting/topicArchetypes';
import {
  ARCHETYPE_NAMES_FILE,
  ARCHETYPE_TOPICS_FILE,
  INDEX_TO_ORACLE_FILE,
  LEGACY_MODEL_VERSION,
  MODEL_POINTER_KEY,
  MODEL_PREFIX,
  type ModelPointer,
  modelVersionPrefix,
  parseModelPointer,
} from '@utils/ml/modelBundle';
import { publicS3, s3 } from '../dynamo/s3client';

export interface ArchetypeData {
  version: string;
  topics: ArchetypeTopicsFile;
  names: ArchetypeNamesFile;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
// Production waits for the first read before taking traffic; don't let a hung S3 call hold boot.
const INITIAL_READ_TIMEOUT_MS = 10 * 1000;

let servedVersion = LEGACY_MODEL_VERSION;
// Null until a served version's archetypes are read, and while the served version has none.
let archetypes: ArchetypeData | null = null;
// The version whose archetypes were last looked for, so a version without any isn't re-read.
let archetypesCheckedFor: string | null = null;
// Null until a served version's vocabulary is read.
let vocabulary: { version: string; oracles: ReadonlySet<string> } | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

const clientFor = (bucket: string) => (bucket === 'cubecobra-public' ? publicS3 : s3);

const isMissingObject = (err: unknown, bucket: string): boolean => {
  const { name, $metadata } = (err ?? {}) as { name?: string; $metadata?: { httpStatusCode?: number } };
  const status = $metadata?.httpStatusCode;
  // An anonymous request for a key that doesn't exist gets 403 unless the bucket allows public listing.
  return (
    name === 'NoSuchKey' || name === 'NotFound' || status === 404 || (bucket === 'cubecobra-public' && status === 403)
  );
};

// The object's text, or null when it doesn't exist. Other failures throw, so a flaky read is never
// mistaken for a missing pointer or missing archetypes.
const readText = async (bucket: string, key: string): Promise<string | null> => {
  try {
    const res = await clientFor(bucket).getObject({ Bucket: bucket, Key: key });
    return (await res.Body?.transformToString()) ?? null;
  } catch (err) {
    if (isMissingObject(err, bucket)) return null;
    throw err;
  }
};

/** model/current.json in `bucket`, or null when there is none (the bucket has the legacy layout). */
export const readModelPointer = async (bucket: string): Promise<ModelPointer | null> => {
  const raw = await readText(bucket, MODEL_POINTER_KEY);
  return raw === null ? null : parseModelPointer(raw);
};

export const archetypeNamesKey = (version: string): string => `${modelVersionPrefix(version)}${ARCHETYPE_NAMES_FILE}`;

/** A bundle's archetype topics and names, or null when it has none (the legacy v3). */
export const readArchetypeFiles = async (
  bucket: string,
  version: string,
): Promise<{ topics: ArchetypeTopicsFile; names: ArchetypeNamesFile } | null> => {
  const [topics, names] = await Promise.all([
    readText(bucket, `${modelVersionPrefix(version)}${ARCHETYPE_TOPICS_FILE}`),
    readText(bucket, archetypeNamesKey(version)),
  ]);
  if (topics === null || names === null) return null;
  return { topics: JSON.parse(topics), names: JSON.parse(names) };
};

/** The oracles a bundle's model was trained on, or null when it has no index map. */
export const readModelVocabulary = async (bucket: string, version: string): Promise<Set<string> | null> => {
  const keys = [`${modelVersionPrefix(version)}${INDEX_TO_ORACLE_FILE}`];
  // The legacy bundle may still sit in the flat layout (see downloadModelsFromS3).
  if (version === LEGACY_MODEL_VERSION) keys.push(`${MODEL_PREFIX}${INDEX_TO_ORACLE_FILE}`);
  for (const key of keys) {
    const raw = await readText(bucket, key);
    if (raw !== null) return new Set(Object.values(JSON.parse(raw) as Record<string, string>));
  }
  return null;
};

/** The model version this environment serves. */
export const getServedModelVersion = (): string => servedVersion;

/** The archetypes decks are classified with, or null when the served version has none. */
export const getArchetypeData = (): ArchetypeData | null => archetypes;

/** The oracles the served model was trained on, or null until they're read for the served version. */
export const getModelVocabulary = (): ReadonlySet<string> | null =>
  vocabulary?.version === servedVersion ? vocabulary.oracles : null;

/** Re-reads the pointer and, when needed, the archetypes and the vocabulary. Never throws. */
export const refreshModelPointer = async (): Promise<void> => {
  const bucket = process.env.DATA_BUCKET;
  if (!bucket) return;
  try {
    const version = (await readModelPointer(bucket))?.version ?? LEGACY_MODEL_VERSION;
    // Topics classify from cards alone, so the ones loaded at boot stay valid whatever model is
    // served, and they change only on a restart. Until some are loaded, each new version is checked.
    if (archetypes === null && archetypesCheckedFor !== version) {
      const files = await readArchetypeFiles(bucket, version);
      archetypes = files ? { version, ...files } : null;
      archetypesCheckedFor = version;
      console.info(files ? `Archetypes from model ${version}` : `Model ${version} has no archetypes`);
    }
    servedVersion = version;
  } catch (err) {
    console.warn(`Could not refresh the model pointer; still serving ${servedVersion}:`, (err as Error).message);
  }
  // Read separately so a failure here doesn't hold back the served version. Until it succeeds,
  // getOracleForMl falls back to the metadata dict alone, and the next refresh tries again.
  if (vocabulary?.version !== servedVersion) {
    try {
      const oracles = await readModelVocabulary(bucket, servedVersion);
      if (oracles) {
        vocabulary = { version: servedVersion, oracles };
        console.info(`Vocabulary of model ${servedVersion}: ${oracles.size} oracles`);
      } else {
        console.warn(`Model ${servedVersion} has no ${INDEX_TO_ORACLE_FILE}`);
      }
    } catch (err) {
      console.warn(`Could not read the vocabulary of model ${servedVersion}:`, (err as Error).message);
    }
  }
};

/**
 * Reads the pointer now and every five minutes after. Resolves once the first read finishes or
 * times out; the timer doesn't keep the process alive.
 */
export const startModelPointerRefresh = async (): Promise<void> => {
  if (!refreshTimer) {
    refreshTimer = setInterval(refreshModelPointer, REFRESH_INTERVAL_MS);
    refreshTimer.unref();
  }
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, INITIAL_READ_TIMEOUT_MS).unref());
  await Promise.race([refreshModelPointer(), timeout]);
};
