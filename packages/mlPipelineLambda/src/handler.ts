// Steps of the ML retraining state machine (packages/cdk/lib/ml-pipeline.ts). One bundle, deployed
// twice: MlPipeline-* (outside the VPC; DynamoDB, S3, Elastic Beanstalk) runs every action but
// `verify`, which runs in MlPipelineVerify-* (inside the VPC, to reach the recommenders' internal
// load balancers). Each action that touches a run keeps its RetrainTask up to date for the admin page.
//
// Promoting only moves model/current.json: every recommender instance polls it and hot-reloads the
// model it names, and its GET /version reports the version it actually serves.
import { retrainTaskDao } from '@server/dynamo/daos';
import { PromotionTarget, RetrainMode, RetrainTask } from '@utils/datatypes/RetrainTask';
import {
  ArchetypeReport,
  BUNDLE_MANIFEST_FILE,
  GateReport,
  isValidModelVersion,
  LEGACY_MODEL_VERSION,
  MODEL_POINTER_KEY,
  MODEL_PREFIX,
  ModelPointer,
  modelVersionPrefix,
  newRunId,
  parseModelPointer,
  runPrefix,
} from '@utils/ml/modelBundle';

import { isPromotionTarget, promoteTarget, runsBucket } from './config';
import { readyEndpoint } from './environment';
import { StepFunctionsError, summarizeError } from './errors';
import { deleteObject, objectExists, readJson, readText, writeJson } from './s3';
import { servesVersion } from './verify';

// The execution input: { mode: 'train', runId?, exportedAt? } or { mode: 'promote', version }.
// Passed whole, since optional fields can't be picked out individually in the state machine.
interface ExecutionInput {
  mode?: unknown;
  runId?: unknown;
  version?: unknown;
  exportedAt?: unknown;
}

interface Run {
  runId: string;
  version: string;
  mode: RetrainMode;
}

// State of the promote/verify loop.
interface Promotion {
  target: PromotionTarget;
  version: string;
  url: string;
  // null (not absent) when there was none, so the state machine can always pass it on.
  previousVersion: string | null;
  attempts: number;
}

type MlPipelineEvent =
  | { action: 'prepare'; input: ExecutionInput; executionArn: string }
  | { action: 'step'; runId: string; step: string }
  | { action: 'gate'; runId: string }
  | { action: 'awaitApproval'; runId: string; taskToken: string }
  | { action: 'promote'; runId: string; version: string; target: PromotionTarget }
  | ({ action: 'verify' } & Promotion)
  | { action: 'revert'; runId: string; version: string; target: PromotionTarget }
  | { action: 'finalize'; runId: string }
  | { action: 'fail'; runId?: string | null; error?: StepFunctionsError };

const requireTask = (task: RetrainTask | undefined, runId: string): RetrainTask => {
  if (!task) {
    throw new Error(`No retrain task ${runId}`);
  }
  return task;
};

// A published bundle has a manifest; the legacy model predates manifests, so look for its encoder.
const isPublished = (bucket: string, version: string): Promise<boolean> =>
  objectExists(
    bucket,
    `${modelVersionPrefix(version)}${version === LEGACY_MODEL_VERSION ? 'encoder/model.json' : BUNDLE_MANIFEST_FILE}`,
  );

/** Creates the run's RetrainTask. TRAIN runs publish their run id as the version. */
const prepare = async (input: ExecutionInput, executionArn: string): Promise<Run> => {
  if (input?.mode === RetrainMode.TRAIN) {
    const runId = input.runId ?? newRunId();
    if (!isValidModelVersion(runId)) {
      throw new Error(`Invalid run id: ${String(runId)}`);
    }
    const exportedAt = typeof input.exportedAt === 'number' ? input.exportedAt : undefined;
    await retrainTaskDao.create({ id: runId, mode: RetrainMode.TRAIN, version: runId, executionArn, exportedAt });
    return { runId, version: runId, mode: RetrainMode.TRAIN };
  }

  if (input?.mode === RetrainMode.PROMOTE) {
    const { version } = input;
    if (!isValidModelVersion(version)) {
      throw new Error(`Invalid model version: ${String(version)}`);
    }
    const bucket = promoteTarget('production').dataBucket;
    if (!(await isPublished(bucket, version))) {
      throw new Error(`Model ${version} is not published in s3://${bucket}/${modelVersionPrefix(version)}`);
    }
    const runId = newRunId();
    await retrainTaskDao.create({ id: runId, mode: RetrainMode.PROMOTE, version, executionArn });
    return { runId, version, mode: RetrainMode.PROMOTE };
  }

  throw new Error(`Unknown mode: ${String(input?.mode)}`);
};

/** Stores the evaluation for the admin page and tells the state machine whether to publish. */
const gate = async (runId: string): Promise<{ passed: boolean }> => {
  const bucket = runsBucket();
  const prefix = runPrefix(runId);
  const report = await readJson<GateReport>(bucket, `${prefix}eval.json`);
  if (!report) {
    throw new Error(`No gate report at s3://${bucket}/${prefix}eval.json`);
  }
  const archetypes = await readJson<ArchetypeReport>(bucket, `${prefix}archetypes.json`);

  requireTask(
    await retrainTaskDao.setGate(runId, {
      passed: report.passed,
      reasons: report.reasons,
      candidate: report.candidate,
      live: report.live,
      liveVersion: report.liveVersion,
      archetypeShift: archetypes?.shiftShare,
    }),
    runId,
  );
  return { passed: report.passed === true };
};

// The version a promotion replaces, recorded for rollback.
const replacedVersion = async (bucket: string, runId: string, version: string): Promise<string | undefined> => {
  const raw = await readText(bucket, MODEL_POINTER_KEY);
  if (raw) {
    const pointer = parseModelPointer(raw);
    // A retry of this same promotion finds its own pointer; keep the version that one replaced.
    return pointer.runId === runId && pointer.version === version ? pointer.previousVersion : pointer.version;
  }
  // Before the first pointer, the environment serves the unversioned legacy model, if it has one.
  return (await objectExists(bucket, `${MODEL_PREFIX}encoder/model.json`)) ? LEGACY_MODEL_VERSION : undefined;
};

/**
 * Points `target` at `version`; its recommenders pick it up on their next poll. The verify loop
 * then polls the returned url until every response reports the new version.
 */
const promote = async (runId: string, version: string, target: PromotionTarget): Promise<Promotion> => {
  if (!isPromotionTarget(target)) {
    throw new Error(`Unknown promotion target: ${String(target)}`);
  }
  if (!isValidModelVersion(version)) {
    throw new Error(`Invalid model version: ${String(version)}`);
  }
  const { dataBucket, recommenderEnvironmentName } = promoteTarget(target);

  // Checked before anything moves, so a deploy in progress just delays the promotion.
  const endpoint = await readyEndpoint(recommenderEnvironmentName);

  const previousVersion = await replacedVersion(dataBucket, runId, version);
  const pointer: ModelPointer = { version, runId, promotedAt: Date.now(), previousVersion };
  await writeJson(dataBucket, MODEL_POINTER_KEY, pointer);
  requireTask(await retrainTaskDao.recordPromotion(runId, target, previousVersion), runId);
  console.log(`Promoted ${version} to ${target}, replacing ${previousVersion ?? 'nothing'}`);

  return { target, version, url: `http://${endpoint}`, previousVersion: previousVersion ?? null, attempts: 0 };
};

/**
 * Undoes a promotion that failed after the pointer may have moved, so recommender instances that
 * start (or reload) later don't load the failed version. Only touches the pointer while it still
 * names `version` as moved by this run; anything else means it has been moved since, and that wins.
 * The version to go back to is the one promote stored in the pointer itself, which is there even
 * when promote failed before returning it.
 */
const revert = async (runId: string, version: string, target: PromotionTarget): Promise<{ reverted: boolean }> => {
  if (!isPromotionTarget(target)) {
    throw new Error(`Unknown promotion target: ${String(target)}`);
  }
  const { dataBucket } = promoteTarget(target);
  const raw = await readText(dataBucket, MODEL_POINTER_KEY);
  const pointer = raw ? parseModelPointer(raw) : null;
  if (!pointer || pointer.version !== version || pointer.runId !== runId) {
    console.log(`Not reverting ${target}: its pointer doesn't name ${version} from run ${runId}`);
    return { reverted: false };
  }
  const { previousVersion } = pointer;
  if (!previousVersion) {
    console.log(`Not reverting ${target}: nothing before ${version} to go back to`);
    return { reverted: false };
  }

  if (previousVersion === LEGACY_MODEL_VERSION && !(await isPublished(dataBucket, previousVersion))) {
    // Before the first pointer the environment served the flat legacy layout; go back to that.
    await deleteObject(dataBucket, MODEL_POINTER_KEY);
  } else {
    // The failed version isn't recorded as previousVersion, so a rollback never offers it.
    const restored: ModelPointer = { version: previousVersion, runId, promotedAt: Date.now() };
    await writeJson(dataBucket, MODEL_POINTER_KEY, restored);
  }
  console.log(`Reverted ${target} from ${version} to ${previousVersion}`);
  return { reverted: true };
};

export const handler = async (event: MlPipelineEvent): Promise<unknown> => {
  // Not the whole event: awaitApproval carries the task token.
  console.log(`ML pipeline action ${event.action}`, 'runId' in event ? { runId: event.runId } : {});

  switch (event.action) {
    case 'prepare':
      return prepare(event.input, event.executionArn);

    case 'step':
      requireTask(await retrainTaskDao.updateStep(event.runId, event.step), event.runId);
      return null;

    case 'gate':
      return gate(event.runId);

    case 'awaitApproval':
      // The state now waits for the web server to answer with this token.
      requireTask(await retrainTaskDao.awaitApproval(event.runId, event.taskToken), event.runId);
      return null;

    case 'promote':
      return promote(event.runId, event.version, event.target);

    case 'verify': {
      // HTTP errors just mean not ready yet; the state machine decides when to give up.
      const { target, version, url, previousVersion, attempts } = event;
      const ready = await servesVersion(url, version);
      return { target, version, url, previousVersion, attempts: attempts + 1, ready };
    }

    case 'revert':
      return revert(event.runId, event.version, event.target);

    case 'finalize':
      requireTask(await retrainTaskDao.updateStep(event.runId, 'Done'), event.runId);
      await retrainTaskDao.markAsCompleted(event.runId);
      return null;

    case 'fail': {
      const message = summarizeError(event.error);
      console.error(`ML pipeline run ${event.runId ?? '(not created)'} failed: ${message}`);
      if (event.runId) {
        await retrainTaskDao.markAsFailed(event.runId, message);
      }
      return null;
    }

    default:
      throw new Error(`Unknown action: ${String((event as { action?: unknown }).action)}`);
  }
};
