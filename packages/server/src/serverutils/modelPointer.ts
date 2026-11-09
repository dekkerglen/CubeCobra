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
 * legacy v3 bundle has no topics; it uses the static embedding cluster centers in src/static/,
 * which classify through the recommender's encoder.
 */
import type { ClusterCenter } from '@utils/drafting/archetype';
import type { ArchetypeNamesFile, ArchetypeTopicsFile } from '@utils/drafting/topicArchetypes';
import {
  ARCHETYPE_NAMES_FILE,
  ARCHETYPE_TOPICS_FILE,
  LEGACY_MODEL_VERSION,
  MODEL_POINTER_KEY,
  type ModelPointer,
  modelVersionPrefix,
  parseModelPointer,
} from '@utils/ml/modelBundle';
import fs from 'fs';
import path from 'path';

import { publicS3, s3 } from '../dynamo/s3client';

export type ArchetypeData =
  | { kind: 'topics'; version: string; topics: ArchetypeTopicsFile; names: ArchetypeNamesFile }
  | { kind: 'centers'; version: string; centers: ClusterCenter[]; annotations: Record<string, string> };

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
// Production waits for the first read before taking traffic; don't let a hung S3 call hold boot.
const INITIAL_READ_TIMEOUT_MS = 10 * 1000;

const STATIC_DIR = path.join(__dirname, '..', 'static');

let servedVersion = LEGACY_MODEL_VERSION;
// Null until the first successful read; the static centers stand in until then.
let archetypes: ArchetypeData | null = null;
let staticCenters: { centers: ClusterCenter[]; annotations: Record<string, string> } | null = null;
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

const loadStaticCenters = (): { centers: ClusterCenter[]; annotations: Record<string, string> } => {
  if (!staticCenters) {
    const readJson = <T>(file: string, fallback: T): T => {
      try {
        return JSON.parse(fs.readFileSync(path.join(STATIC_DIR, file), 'utf8'));
      } catch {
        console.warn(`${file} not found, archetype classification disabled`);
        return fallback;
      }
    };
    staticCenters = {
      centers: readJson<ClusterCenter[]>('clusterCenters.json', []),
      annotations: readJson<Record<string, string>>('annotations.json', {}),
    };
  }
  return staticCenters;
};

/** The model version this environment serves. */
export const getServedModelVersion = (): string => servedVersion;

/** The archetypes decks are classified with. */
export const getArchetypeData = (): ArchetypeData =>
  archetypes ?? { kind: 'centers', version: servedVersion, ...loadStaticCenters() };

/** Re-reads the pointer and, when needed, the archetypes (see refreshModelPointer). Never throws. */
export const refreshModelPointer = async (): Promise<void> => {
  const bucket = process.env.DATA_BUCKET;
  if (!bucket) return;
  try {
    const version = (await readModelPointer(bucket))?.version ?? LEGACY_MODEL_VERSION;
    // Topics classify from cards alone, so the ones loaded at boot stay valid whatever model is
    // served, and they change only on a restart. Centers are positions in one encoder's embedding
    // space, and the recommender hot-swaps its encoder on promotion, so they have to follow it.
    const reloadArchetypes = archetypes === null || (archetypes.kind === 'centers' && archetypes.version !== version);
    if (reloadArchetypes) {
      const files = await readArchetypeFiles(bucket, version);
      archetypes = files ? { kind: 'topics', version, ...files } : { kind: 'centers', version, ...loadStaticCenters() };
      console.info(`Archetypes: ${archetypes.kind} from model ${version}`);
    }
    servedVersion = version;
  } catch (err) {
    console.warn(`Could not refresh the model pointer; still serving ${servedVersion}:`, (err as Error).message);
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
