import { RetrainMode, RetrainTask, RetrainTaskStatus } from '@utils/datatypes/RetrainTask';
import { UserRoles } from '@utils/datatypes/User';
import type { ArchetypeNamesFile, ArchetypeNamingOutcome, ArchetypeTopicsFile } from '@utils/drafting/topicArchetypes';
import {
  type ArchetypeReport,
  type GateReport,
  isValidModelVersion,
  LEGACY_MODEL_VERSION,
  newRunId,
  type RunMetrics,
} from '@utils/ml/modelBundle';
import { retrainTaskDao } from 'dynamo/daos';
import { getBucketName } from 'dynamo/s3client';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirectToAdminTab } from 'serverutils/adminDashboard';
import {
  clearAdminAlertsCache,
  isPipelineConfigured,
  listPublishedVersions,
  readRunFile,
  toClientRun,
} from 'serverutils/mlRetraining';
import { readModelPointer } from 'serverutils/modelPointer';
import { approveRun, isStaleTokenError, rejectRun, startPipeline } from 'serverutils/stepFunctions';
import { NextFunction, Request, Response } from 'types/express';

const RUN_LIMIT = 25;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

// Everything the tab shows; it loads this when opened and again to refresh after an action.
const loadState = async () => {
  const bucket = getBucketName();
  const [{ items }, pointer, publishedVersions] = await Promise.all([
    retrainTaskDao.listAll(RUN_LIMIT),
    readModelPointer(bucket),
    listPublishedVersions(bucket),
  ]);
  return {
    runs: items.map(toClientRun),
    pointer,
    servedVersion: pointer?.version ?? LEGACY_MODEL_VERSION,
    publishedVersions,
    configured: isPipelineConfigured(),
  };
};

export const stateHandler = async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({ success: true, ...(await loadState()) });
  } catch (error) {
    return res.status(500).json({ success: false, error: errorMessage(error) });
  }
};

// One run's metrics, gate report, archetype report and its bundle's archetype topics and names;
// each is null until the run writes it.
export const runDetailsHandler = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidModelVersion(id)) {
    return res.status(400).json({ success: false, error: 'Invalid run id' });
  }
  try {
    const [metrics, gate, archetypes, topics, names, naming] = await Promise.all([
      readRunFile<RunMetrics>(id, 'metrics.json'),
      readRunFile<GateReport>(id, 'eval.json'),
      readRunFile<ArchetypeReport>(id, 'archetypes.json'),
      readRunFile<ArchetypeTopicsFile>(id, 'bundle/archetypes/topics.json'),
      readRunFile<ArchetypeNamesFile>(id, 'bundle/archetypes/names.json'),
      readRunFile<ArchetypeNamingOutcome>(id, 'bundle/archetypes/naming.json'),
    ]);
    return res.status(200).json({
      success: true,
      metrics,
      gate,
      archetypes,
      // Without cardTopics, the per-card table only classification needs.
      topics: topics?.topics ?? null,
      names: names?.names ?? null,
      naming,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: errorMessage(error) });
  }
};

// Every action below drives the state machine or its records, which only production has.
const ensureConfigured = (_req: Request, res: Response, next: NextFunction) => {
  if (!isPipelineConfigured()) {
    return res.status(503).json({ success: false, error: 'ML_PIPELINE_STATE_MACHINE_ARN is not set' });
  }
  return next();
};

const findRun = async (req: Request, res: Response): Promise<RetrainTask | undefined> => {
  const { id } = req.params;
  const task = isValidModelVersion(id) ? await retrainTaskDao.getById(id) : undefined;
  if (!task) {
    res.status(404).json({ success: false, error: 'Run not found' });
  }
  return task;
};

const decisionHandler = (approved: boolean) => async (req: Request, res: Response) => {
  try {
    const task = await findRun(req, res);
    if (!task) return undefined;
    const { taskToken } = task;
    if (task.status !== RetrainTaskStatus.AWAITING_APPROVAL || !taskToken) {
      return res.status(409).json({ success: false, error: 'This run is not awaiting approval.' });
    }

    await retrainTaskDao.recordDecision(task.id, approved, req.user!.id);
    clearAdminAlertsCache();
    try {
      if (approved) {
        await approveRun(taskToken, req.user!.id);
      } else {
        await rejectRun(taskToken, req.user!.username);
      }
    } catch (error) {
      if (isStaleTokenError(error)) {
        return res.status(409).json({ success: false, error: 'This run is no longer awaiting approval.' });
      }
      // The execution is still waiting, so put the token back and let the decision be retried.
      await retrainTaskDao.awaitApproval(task.id, taskToken);
      throw error;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    req.logger.error(`ML retraining decision failed: ${errorMessage(error)}`);
    return res.status(500).json({ success: false, error: errorMessage(error) });
  }
};

// Dismisses a failed run's admin alert.
export const acknowledgeHandler = async (req: Request, res: Response) => {
  try {
    const task = await findRun(req, res);
    if (!task) return undefined;
    if (task.status !== RetrainTaskStatus.FAILED) {
      return res.status(409).json({ success: false, error: 'Only failed runs can be dismissed.' });
    }
    await retrainTaskDao.acknowledge(task.id);
    clearAdminAlertsCache();
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: errorMessage(error) });
  }
};

const runningTask = async (): Promise<RetrainTask | undefined> => {
  const [inProgress, awaiting] = await Promise.all([
    retrainTaskDao.listByStatus(RetrainTaskStatus.IN_PROGRESS, 1),
    retrainTaskDao.listByStatus(RetrainTaskStatus.AWAITING_APPROVAL, 1),
  ]);
  return inProgress[0] ?? awaiting[0];
};

export const startHandler = async (req: Request, res: Response) => {
  try {
    const running = await runningTask();
    if (running) {
      const state = running.status === RetrainTaskStatus.AWAITING_APPROVAL ? 'awaiting approval' : 'in progress';
      return res.status(409).json({ success: false, error: `Run ${running.id} is still ${state}.` });
    }

    const runId = newRunId();
    const executionArn = await startPipeline(`admin-${runId}`, { mode: RetrainMode.TRAIN, runId });
    return res.status(200).json({ success: true, runId, executionArn });
  } catch (error) {
    req.logger.error(`Starting ML retraining failed: ${errorMessage(error)}`);
    return res.status(500).json({ success: false, error: errorMessage(error) });
  }
};

// Promotes an already published version: a rollback, or re-promoting a newer one.
export const promoteHandler = async (req: Request, res: Response) => {
  try {
    const { version } = req.body || {};
    if (!isValidModelVersion(version)) {
      return res.status(400).json({ success: false, error: 'Invalid version' });
    }
    const published = await listPublishedVersions(getBucketName());
    if (!published.includes(version)) {
      return res.status(400).json({ success: false, error: `Version ${version} is not published.` });
    }

    const executionArn = await startPipeline(`admin-promote-${newRunId()}`, { mode: RetrainMode.PROMOTE, version });
    return res.status(200).json({ success: true, executionArn });
  } catch (error) {
    req.logger.error(`Promoting model failed: ${errorMessage(error)}`);
    return res.status(500).json({ success: false, error: errorMessage(error) });
  }
};

const admin = [csrfProtection, ensureRole(UserRoles.ADMIN)];

export const routes = [
  { method: 'get', path: '/', handler: [...admin, redirectToAdminTab('mlretraining')] },
  { method: 'get', path: '/state', handler: [...admin, stateHandler] },
  { method: 'get', path: '/run/:id', handler: [...admin, runDetailsHandler] },
  { method: 'post', path: '/run/:id/approve', handler: [...admin, ensureConfigured, decisionHandler(true)] },
  { method: 'post', path: '/run/:id/reject', handler: [...admin, ensureConfigured, decisionHandler(false)] },
  { method: 'post', path: '/run/:id/acknowledge', handler: [...admin, ensureConfigured, acknowledgeHandler] },
  { method: 'post', path: '/start', handler: [...admin, ensureConfigured, startHandler] },
  { method: 'post', path: '/promote', handler: [...admin, ensureConfigured, promoteHandler] },
];
