// Settings for the ML retraining stages that run on the jobs image (processTrainingData,
// evaluateModel, publishModel). The state machine passes ML_RUN_ID per
// execution; everything else comes from the task definition (packages/cdk/lib/ml-pipeline.ts).

// Training keeps drafts from the last WINDOW_YEARS years, because drafting habits change, and cubes
// updated at least once in that window, so abandoned lists don't skew the sample. The window is
// counted back from the export date, so rerunning on the same export selects the same data.
export const WINDOW_YEARS = 3;

// Share of cubes and drafts held out for validation and the promotion gate, chosen by hashing the
// cube or draft id so the same record always lands in the same split.
export const TEST_PERCENT = 5;

// Records per processed data shard.
export const SHARD_SIZE = 10000;

// Decks with fewer real (non-basic) mainboard cards are token/art-only entries that pollute the
// co-occurrence matrix.
export const MIN_MAINBOARD = 20;

// Test-split examples the gate scores both models on. Python's per-checkpoint validation uses the
// same counts (packages/ml/ccml/validation.py).
export const GATE_SAMPLE = { cubes: 2000, decks: 5000, picks: 20000 };

// A candidate passes when every gate metric is at least the live model's minus this.
export const GATE_TOLERANCE = 0.005;

// Largest elementwise difference allowed between the Keras reference outputs and the converted
// TF.js model on the same inputs.
export const PARITY_TOLERANCE = 1e-4;

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
};

export const mlRunId = (): string => required('ML_RUN_ID');
export const mlRunsBucket = (): string => required('ML_RUNS_BUCKET');
export const mlExportBucket = (): string => process.env.ML_EXPORT_BUCKET || 'cubecobra-public';
export const mlLiveBucket = (): string => required('ML_LIVE_BUCKET');

export const mlPublishBuckets = (): string[] =>
  required('ML_PUBLISH_BUCKETS')
    .split(',')
    .map((bucket) => bucket.trim())
    .filter(Boolean);

export interface R2Target {
  name: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

// ML_R2_TARGETS=production,beta with ML_R2_<NAME>_ENDPOINT/_BUCKET/_ACCESS_KEY_ID/_SECRET_ACCESS_KEY.
export const mlR2Targets = (): R2Target[] =>
  (process.env.ML_R2_TARGETS || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => {
      const prefix = `ML_R2_${name.toUpperCase()}_`;
      return {
        name,
        endpoint: required(`${prefix}ENDPOINT`),
        bucket: required(`${prefix}BUCKET`),
        accessKeyId: required(`${prefix}ACCESS_KEY_ID`),
        secretAccessKey: required(`${prefix}SECRET_ACCESS_KEY`),
      };
    });
