import { SimulationRunData, SimulationRunEntry } from '@utils/datatypes/SimulationReport';
import { cubeDao } from 'dynamo/daos';
import { deleteObject, getBucketName, getObject, putObject } from 'dynamo/s3client';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { MAX_DRAFTS, MAX_HISTORY, MAX_SEATS, MAX_TOTAL_SEATS } from 'serverutils/simulatorConstants';

import { Request, Response } from '../../../../types/express';

const DELETE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const indexKey = (cubeId: string) => `cube/${cubeId}/draftsimulator/index.json`;
const runKey = (cubeId: string, ts: number) => `cube/${cubeId}/draftsimulator/${ts}.json`;

// POST /:id — save a new run (summary + slim pools + card meta)
export const saveHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Must be logged in' });
    }

    const cubeId = req.params.id;
    if (!cubeId) {
      return res.status(400).json({ success: false, message: 'Cube ID required' });
    }

    const cube = await cubeDao.getById(cubeId);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found' });
    }
    if (!isCubeEditable(cube, req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Only the cube owner or collaborators can save simulation results' });
    }

    const runData: SimulationRunData = req.body;
    if (
      !runData ||
      typeof runData.numDrafts !== 'number' ||
      typeof runData.numSeats !== 'number' ||
      runData.numDrafts < 1 ||
      runData.numDrafts > MAX_DRAFTS ||
      runData.numSeats < 2 ||
      runData.numSeats > MAX_SEATS ||
      !Array.isArray(runData.cardStats) ||
      !Array.isArray(runData.slimPools)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid simulation data' });
    }
    if (runData.slimPools.length > MAX_TOTAL_SEATS) {
      return res.status(400).json({ success: false, message: 'Simulation data too large' });
    }
    // Validate each slim pool has the expected shape
    for (const pool of runData.slimPools) {
      if (!Array.isArray(pool.picks) || typeof pool.draftIndex !== 'number' || typeof pool.seatIndex !== 'number') {
        return res.status(400).json({ success: false, message: 'Invalid pool data' });
      }
    }

    // Override server-controlled fields — don't trust client
    runData.cubeId = cube.id;
    runData.cubeName = cube.name;

    const ts = Date.now();
    runData.generatedAt = new Date(ts).toISOString();
    const bucket = getBucketName();

    await putObject(bucket, runKey(cube.id, ts), runData);

    const existingIndex: SimulationRunEntry[] = (await getObject(bucket, indexKey(cube.id))) ?? [];

    const entry: SimulationRunEntry = {
      ts,
      generatedAt: runData.generatedAt,
      numDrafts: runData.numDrafts,
      numSeats: runData.numSeats,
      deadCardCount: Array.isArray(runData.deadCards) ? runData.deadCards.length : 0,
      convergenceScore: runData.convergenceScore ?? 0,
    };
    const updatedIndex = [entry, ...existingIndex].slice(0, MAX_HISTORY);
    // existingIndex doesn't yet include the new entry, so slice at MAX_HISTORY-1 to find
    // entries that fall off the end after inserting the new one
    const droppedEntries = existingIndex.slice(MAX_HISTORY - 1);

    await putObject(bucket, indexKey(cube.id), updatedIndex);
    await cubeDao.update({ ...cube, lastDraftSimulation: ts }, { skipTimestampUpdate: true });

    // Best-effort cleanup of orphaned run files — don't block the response on this
    for (const dropped of droppedEntries) {
      deleteObject(bucket, runKey(cube.id, dropped.ts)).catch(() => {});
    }

    return res.status(200).json({ success: true, ts });
  } catch (err) {
    req.logger.error(`Error in simulatesave POST: ${err}`, err instanceof Error ? err.stack : '');
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /:id — load run history index + full data for the latest run
export const getIndexHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.id;
    if (!cubeId) {
      return res.status(400).json({ success: false, message: 'Cube ID required' });
    }

    const cube = await cubeDao.getById(cubeId);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found' });
    }

    const bucket = getBucketName();
    const runs: SimulationRunEntry[] = (await getObject(bucket, indexKey(cube.id))) ?? [];
    return res.status(200).json({ success: true, runs });
  } catch (err) {
    req.logger.error(`Error in simulatesave GET index: ${err}`, err instanceof Error ? err.stack : '');
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /:id/:ts — load a specific historical run by its Unix-ms timestamp
export const getRunHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.id;
    const ts = parseInt(req.params.ts ?? '', 10);

    if (!cubeId) {
      return res.status(400).json({ success: false, message: 'Cube ID required' });
    }
    if (isNaN(ts)) {
      return res.status(400).json({ success: false, message: 'Invalid run timestamp' });
    }

    const cube = await cubeDao.getById(cubeId);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found' });
    }

    const bucket = getBucketName();
    const runData = await getObject(bucket, runKey(cube.id, ts));

    if (!runData) {
      return res.status(404).json({ success: false, message: 'Run not found' });
    }

    return res.status(200).json({ success: true, runData });
  } catch (err) {
    req.logger.error(`Error in simulatesave GET run: ${err}`, err instanceof Error ? err.stack : '');
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /:id/:ts — delete a specific historical run by its Unix-ms timestamp
export const deleteRunHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Must be logged in' });
    }

    const cubeId = req.params.id;
    const ts = parseInt(req.params.ts ?? '', 10);

    if (!cubeId) {
      return res.status(400).json({ success: false, message: 'Cube ID required' });
    }
    if (isNaN(ts)) {
      return res.status(400).json({ success: false, message: 'Invalid run timestamp' });
    }

    const cube = await cubeDao.getById(cubeId);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found' });
    }
    if (!isCubeEditable(cube, req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Only the cube owner or collaborators can delete simulation results' });
    }

    if (Date.now() - ts < DELETE_COOLDOWN_MS) {
      return res.status(403).json({ success: false, message: 'Cannot delete a run from the last 24 hours' });
    }

    const bucket = getBucketName();
    const runs: SimulationRunEntry[] = (await getObject(bucket, indexKey(cube.id))) ?? [];
    const runExists = runs.some((run) => run.ts === ts);

    if (!runExists) {
      return res.status(404).json({ success: false, message: 'Run not found' });
    }

    const updatedRuns = runs.filter((run) => run.ts !== ts);

    await Promise.all([putObject(bucket, indexKey(cube.id), updatedRuns), deleteObject(bucket, runKey(cube.id, ts))]);

    const latestRunData = updatedRuns.length > 0 ? await getObject(bucket, runKey(cube.id, updatedRuns[0]!.ts)) : null;

    return res.status(200).json({ success: true, runs: updatedRuns, latestRunData });
  } catch (err) {
    req.logger.error(`Error in simulatesave DELETE run: ${err}`, err instanceof Error ? err.stack : '');
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const routes = [
  { method: 'post', path: '/:id', handler: [saveHandler] },
  { method: 'get', path: '/:id', handler: [getIndexHandler] },
  { method: 'get', path: '/:id/:ts', handler: [getRunHandler] },
  { method: 'delete', path: '/:id/:ts', handler: [deleteRunHandler] },
];
