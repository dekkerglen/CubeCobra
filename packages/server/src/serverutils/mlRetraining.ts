/**
 * Server-side reads for the ML retraining admin page and the admin alert in the nav: run records,
 * the files a training run leaves under ml/runs/<runId>/, and the model versions published under
 * model/ in DATA_BUCKET. Starting and resuming executions is in stepFunctions.ts.
 */
import { RetrainTask } from '@utils/datatypes/RetrainTask';
import {
  isValidModelVersion,
  LEGACY_MODEL_VERSION,
  MODEL_PREFIX,
  REQUIRED_MODEL_NAMES,
  runPrefix,
} from '@utils/ml/modelBundle';

import { retrainTaskDao } from '../dynamo/daos';
import { getBucketName, getObject, s3 } from '../dynamo/s3client';

/** The retraining state machine; only production has one. */
export const stateMachineArn = (): string | undefined => process.env.ML_PIPELINE_STATE_MACHINE_ARN || undefined;

export const isPipelineConfigured = (): boolean => !!stateMachineArn();

// A run as sent to the browser: the Step Functions task token resumes the execution, so it never
// leaves the server.
export type ClientRetrainTask = Omit<RetrainTask, 'taskToken'>;

export const toClientRun = (task: RetrainTask): ClientRetrainTask => {
  const run: Partial<RetrainTask> = { ...task };
  delete run.taskToken;
  return run as ClientRetrainTask;
};

export type RunFile =
  | 'metrics.json'
  | 'eval.json'
  | 'archetypes.json'
  | 'bundle/archetypes/topics.json'
  | 'bundle/archetypes/names.json'
  | 'bundle/archetypes/naming.json';

/** A file from ml/runs/<runId>/ in the production data bucket, or null when it isn't there (yet). */
export const readRunFile = async <T>(runId: string, file: RunFile): Promise<T | null> =>
  getObject(getBucketName(), `${runPrefix(runId)}${file}`);

const LEGACY_FOLDERS: readonly string[] = REQUIRED_MODEL_NAMES;

/**
 * Candidate version names from the folders directly under model/. The legacy flat layout has its
 * own folders there (model/encoder/ ...), which are not versions.
 */
export const versionFolderNames = (prefixes: string[]): string[] =>
  prefixes
    .filter((prefix) => prefix.startsWith(MODEL_PREFIX) && prefix.endsWith('/'))
    .map((prefix) => prefix.slice(MODEL_PREFIX.length, -1))
    .filter((name) => isValidModelVersion(name) && !LEGACY_FOLDERS.includes(name));

const objectExists = async (bucket: string, key: string): Promise<boolean> => {
  try {
    await s3.headObject({ Bucket: bucket, Key: key });
    return true;
  } catch {
    return false;
  }
};

/**
 * Versions that can be promoted: folders under model/ holding a bundle, newest run first, plus the
 * legacy v3 while its flat files are still there.
 */
export const listPublishedVersions = async (bucket: string): Promise<string[]> => {
  const prefixes: string[] = [];
  let token: string | undefined;
  do {
    const res = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: MODEL_PREFIX,
      Delimiter: '/',
      ContinuationToken: token,
    });
    for (const { Prefix } of res.CommonPrefixes || []) {
      if (Prefix) prefixes.push(Prefix);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  const candidates = versionFolderNames(prefixes);
  const present = await Promise.all(
    candidates.map((version) => objectExists(bucket, `${MODEL_PREFIX}${version}/encoder/model.json`)),
  );
  const versions = candidates.filter((_, index) => present[index]);
  const hasLegacyFiles = await objectExists(bucket, `${MODEL_PREFIX}encoder/model.json`);
  if (hasLegacyFiles && !versions.includes(LEGACY_MODEL_VERSION)) {
    versions.push(LEGACY_MODEL_VERSION);
  }

  // Run ids are UTC timestamps, so they sort chronologically; the legacy version predates them all.
  return versions.sort((a, b) => {
    if (a === LEGACY_MODEL_VERSION) return 1;
    if (b === LEGACY_MODEL_VERSION) return -1;
    return b.localeCompare(a);
  });
};

/** Runs an admin should look at, for the nav indicator and the admin dashboard. */
export interface AdminAlerts {
  count: number;
  ids: string[];
}

// Every admin page render reads this, so the query result is shared for a minute.
const ALERTS_TTL_MS = 60 * 1000;
let alertsCache: { value: AdminAlerts; at: number } | null = null;
let alertsInflight: Promise<AdminAlerts> | null = null;

const loadAdminAlerts = async (): Promise<AdminAlerts> => {
  let value = alertsCache?.value ?? { count: 0, ids: [] };
  try {
    const runs = await retrainTaskDao.listNeedingAttention();
    value = { count: runs.length, ids: runs.map((run) => run.id) };
  } catch (err) {
    console.warn('Could not load ML retraining alerts:', (err as Error).message);
  }
  alertsCache = { value, at: Date.now() };
  return value;
};

/** Null where there is no retraining pipeline. Never throws. */
export const getAdminAlerts = async (): Promise<AdminAlerts | null> => {
  if (!isPipelineConfigured()) return null;
  if (alertsCache && Date.now() - alertsCache.at < ALERTS_TTL_MS) return alertsCache.value;
  if (!alertsInflight) {
    alertsInflight = loadAdminAlerts().finally(() => {
      alertsInflight = null;
    });
  }
  return alertsInflight;
};

/** After an admin acts on a run, so their next page shows the alert gone. */
export const clearAdminAlertsCache = (): void => {
  alertsCache = null;
};
