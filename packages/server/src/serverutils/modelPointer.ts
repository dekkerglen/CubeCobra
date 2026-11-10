/**
 * The ML model version this environment serves, per model/current.json in DATA_BUCKET, and the
 * archetype cluster centers that belong to it.
 *
 * The pointer is read once at boot and then every five minutes (startModelPointerRefresh), so a
 * promotion or rollback reaches every server without a deploy. Until the first read succeeds, and
 * whenever S3 can't be reached, the last known version stays in place (initially the legacy v3).
 *
 * Archetype centers live in each bundle (model/<version>/archetypes/) because they are positions
 * in that model's embedding space. The legacy v3 bundle has none; it, and any bundle without them,
 * uses the static files in src/static/.
 */
import type { ClusterCenter } from '@utils/drafting/archetype';
import {
  ARCHETYPE_ANNOTATIONS_FILE,
  ARCHETYPE_CENTERS_FILE,
  LEGACY_MODEL_VERSION,
  MODEL_POINTER_KEY,
  type ModelPointer,
  modelVersionPrefix,
  parseModelPointer,
} from '@utils/ml/modelBundle';
import fs from 'fs';
import path from 'path';

import { publicS3, s3 } from '../dynamo/s3client';

export interface ArchetypeData {
  centers: ClusterCenter[];
  annotations: Record<string, string>;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
// Production waits for the first read before taking traffic; don't let a hung S3 call hold boot.
const INITIAL_READ_TIMEOUT_MS = 10 * 1000;

const STATIC_DIR = path.join(__dirname, '..', 'static');

let servedVersion = LEGACY_MODEL_VERSION;
// Whether servedVersion's archetypes have been looked up in its bundle yet.
let archetypesLoaded = false;
// null: the served bundle has no archetype files, so the static ones apply.
let bundleArchetypes: ArchetypeData | null = null;
let staticArchetypes: ArchetypeData | null = null;
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

const readBundleArchetypes = async (bucket: string, version: string): Promise<ArchetypeData | null> => {
  const prefix = modelVersionPrefix(version);
  const [centers, annotations] = await Promise.all([
    readText(bucket, `${prefix}${ARCHETYPE_CENTERS_FILE}`),
    readText(bucket, `${prefix}${ARCHETYPE_ANNOTATIONS_FILE}`),
  ]);
  if (centers === null || annotations === null) return null;
  return { centers: JSON.parse(centers), annotations: JSON.parse(annotations) };
};

const loadStaticArchetypes = (): ArchetypeData => {
  if (!staticArchetypes) {
    const readJson = <T>(file: string, fallback: T): T => {
      try {
        return JSON.parse(fs.readFileSync(path.join(STATIC_DIR, file), 'utf8'));
      } catch {
        console.warn(`${file} not found, archetype classification disabled`);
        return fallback;
      }
    };
    staticArchetypes = {
      centers: readJson<ClusterCenter[]>('clusterCenters.json', []),
      annotations: readJson<Record<string, string>>('annotations.json', {}),
    };
  }
  return staticArchetypes;
};

/** The model version this environment serves. */
export const getServedModelVersion = (): string => servedVersion;

/** Archetype centers and labels for the served model version. */
export const getArchetypeData = (): ArchetypeData => bundleArchetypes ?? loadStaticArchetypes();

/** Re-reads the pointer and, when the version moved, that version's archetypes. Never throws. */
export const refreshModelPointer = async (): Promise<void> => {
  const bucket = process.env.DATA_BUCKET;
  if (!bucket) return;
  try {
    const version = (await readModelPointer(bucket))?.version ?? LEGACY_MODEL_VERSION;
    if (archetypesLoaded && version === servedVersion) return;

    // Both change together, so a classification never mixes one model's embeddings with another's centers.
    const archetypes = await readBundleArchetypes(bucket, version);
    servedVersion = version;
    bundleArchetypes = archetypes;
    archetypesLoaded = true;
    console.info(`Serving model ${version} (${archetypes ? 'bundle' : 'static'} archetypes)`);
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
