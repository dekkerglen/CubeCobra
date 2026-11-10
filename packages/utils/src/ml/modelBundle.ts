import type { ArchetypeNamingOutcome } from '../drafting/topicArchetypes';

// Layout of trained ML model bundles in S3/R2, shared by the retraining pipeline (packages/ml,
// packages/jobs/src/ml, packages/mlPipelineLambda) and every consumer of the model (recommender,
// server, jobs, browser draft bot).
//
// Published bundles are immutable and live side by side under model/<version>/ in each
// environment's data bucket (and in R2 for the browser). model/current.json names the version
// that environment serves; moving it is how a model is promoted or rolled back.
//
// Bundle contents (relative to model/<version>/ or ml/runs/<runId>/bundle/):
//   encoder/ cube_decoder/ deck_build_decoder/ draft_decoder/   TF.js graph models (model.json + shards)
//   indexToOracleMap.json                                       { "<index>": "<oracle id>" }
//   archetypes/topics.json                                      archetype topics over oracle tags (@utils/drafting/topicArchetypes)
//   archetypes/names.json                                       their names; the one file admins edit after publishing
//   archetypes/naming.json                                      how the names were produced
//   parity.json                                                 Keras reference outputs for the TF.js parity check
//   manifest.json                                               ModelManifest
//
// Training runs keep their working files under ml/runs/<runId>/ in the production data bucket:
//   data/          processed training data (see packages/jobs/src/ml/processTrainingData.ts)
//   checkpoints/   epoch_NNNN/*.weights.h5, final/*.weights.h5, latest.json
//   tensorboard/   TensorBoard event files
//   metrics.json   RunMetrics: training parameters, per-epoch losses, train/test validation
//   bundle/        the bundle above, before it is published
//   eval.json      GateReport: candidate vs live model on the test split
//   archetypes.json ArchetypeReport: topic count, naming outcome, how many test decks change archetype

export const MODEL_PREFIX = 'model/';
export const MODEL_POINTER_KEY = 'model/current.json';
export const ML_RUNS_PREFIX = 'ml/runs/';

export const REQUIRED_MODEL_NAMES = ['encoder', 'cube_decoder', 'deck_build_decoder', 'draft_decoder'] as const;
export type ModelName = (typeof REQUIRED_MODEL_NAMES)[number];

export const INDEX_TO_ORACLE_FILE = 'indexToOracleMap.json';
export const BUNDLE_MANIFEST_FILE = 'manifest.json';
export const PARITY_FILE = 'parity.json';
export const ARCHETYPE_TOPICS_FILE = 'archetypes/topics.json';
// The one bundle file that changes after publishing: admins rename archetypes on the admin page.
export const ARCHETYPE_NAMES_FILE = 'archetypes/names.json';
export const ARCHETYPE_NAMING_FILE = 'archetypes/naming.json';

// The model version served before bundles were versioned. Its files sit directly under model/
// (model/encoder/..., model/indexToOracleMap.json) and in R2 under model/v3/.
export const LEGACY_MODEL_VERSION = 'v3';

export interface ModelPointer {
  version: string;
  runId?: string;
  promotedAt: number;
  previousVersion?: string;
}

export interface ModelManifest {
  version: string;
  runId: string;
  createdAt: number;
  numCards: number;
  exportedAt: number;
  dataWindow: { years: number; start: number };
  trainingParams: Record<string, unknown>;
  code: { gitSha?: string; imageDigest?: string };
  libraries: Record<string, string>;
  models: string[];
}

export interface GateMetrics {
  cubeRecall: number;
  deckAccuracy: number;
  pickTop1: number;
  pickTop3: number;
}

export interface GateReport {
  passed: boolean;
  reasons: string[];
  tolerance: number;
  candidateVersion: string;
  liveVersion: string | null;
  candidate: GateMetrics;
  live: GateMetrics | null;
  counts: { cubes: number; decks: number; picks: number };
  parity: { passed: boolean; maxAbsDiff: number };
  evaluatedAt: number;
}

export interface SplitCounts {
  cubes: number;
  decks: number;
  picks: number;
}

// Written by processTrainingData to ml/runs/<runId>/data/manifest.json.
export interface TrainingDataManifest {
  runId: string;
  exportedAt: number;
  windowYears: number;
  windowStart: number;
  testPercent: number;
  numCards: number;
  train: SplitCounts;
  test: SplitCounts;
  // Records seen in the export but left out, by reason.
  excluded: Record<string, number>;
  createdAt: number;
}

export interface EpochMetrics {
  epoch: number;
  finishedAt: number;
  durationSeconds: number;
  // Keras epoch logs: total loss, per-head losses and the training-time head metrics.
  logs: Record<string, number>;
}

export interface ValidationMetrics {
  epoch: number;
  // The gate metrics on an equal-sized sample of each split; a widening gap means overfitting.
  train: GateMetrics;
  test: GateMetrics;
}

// ml/runs/<runId>/metrics.json, rewritten by the training task after every epoch.
export interface RunMetrics {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  updatedAt: number;
  params: Record<string, unknown>;
  data: TrainingDataManifest;
  epochs: EpochMetrics[];
  validations: ValidationMetrics[];
  resumedFromEpoch?: number;
}

export interface ArchetypeReport {
  topicCount: number;
  naming: ArchetypeNamingOutcome | null;
  // Test decks labeled by both the live archetypes and the candidate's, and the share whose name changed.
  sampleSize: number;
  shiftShare: number;
  createdAt: number;
}

// Version strings become S3 key segments and CDN path segments.
export const isValidModelVersion = (version: unknown): version is string =>
  typeof version === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(version);

export const modelVersionPrefix = (version: string): string => {
  if (!isValidModelVersion(version)) {
    throw new Error(`Invalid model version: ${String(version)}`);
  }
  return `${MODEL_PREFIX}${version}/`;
};

export const runPrefix = (runId: string): string => {
  if (!isValidModelVersion(runId)) {
    throw new Error(`Invalid run id: ${String(runId)}`);
  }
  return `${ML_RUNS_PREFIX}${runId}/`;
};

export const parseModelPointer = (raw: string): ModelPointer => {
  const parsed = JSON.parse(raw) as Partial<ModelPointer>;
  if (!isValidModelVersion(parsed.version)) {
    throw new Error(`Model pointer has an invalid version: ${String(parsed.version)}`);
  }
  return {
    version: parsed.version,
    runId: parsed.runId,
    promotedAt: typeof parsed.promotedAt === 'number' ? parsed.promotedAt : 0,
    previousVersion: isValidModelVersion(parsed.previousVersion) ? parsed.previousVersion : undefined,
  };
};

// True for keys of the unversioned legacy layout (model/encoder/..., model/indexToOracleMap.json),
// so a downloader falling back to it doesn't also pull every versioned bundle under model/.
const LEGACY_ENTRIES = new Set<string>([...REQUIRED_MODEL_NAMES, INDEX_TO_ORACLE_FILE]);
export const isLegacyModelKey = (key: string): boolean => {
  if (!key.startsWith(MODEL_PREFIX) || key.endsWith('/')) return false;
  const [first] = key.slice(MODEL_PREFIX.length).split('/');
  return first !== undefined && LEGACY_ENTRIES.has(first);
};

// Run ids are UTC timestamps (20270206-153000) so they sort chronologically and double as the
// version a run publishes.
export const newRunId = (now: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
};
