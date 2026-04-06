import { SimulationRunData, SimulationRunEntry } from '@utils/datatypes/SimulationReport';
import { cubeDao } from 'dynamo/daos';
import { deleteObject, getBucketName, getObject, putObject } from 'dynamo/s3client';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

const MAX_HISTORY = 5;
const DELETE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const indexKey = (cubeId: string) => `cube/${cubeId}/draftsimulator/index.json`;
const runKey = (cubeId: string, ts: number) => `cube/${cubeId}/draftsimulator/${ts}.json`;

// POST /:id — save a new run (summary + slim pools + card meta)
const saveHandler = async (req: Request, res: Response) => {
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
      return res.status(403).json({ success: false, message: 'Only the cube owner or collaborators can save simulation results' });
    }

    const runData: SimulationRunData = req.body;
    if (!runData || typeof runData.numDrafts !== 'number' || !Array.isArray(runData.cardStats) || !Array.isArray(runData.slimPools)) {
      return res.status(400).json({ success: false, message: 'Invalid simulation data' });
    }

    // Override server-controlled fields — don't trust client
    runData.cubeId = cube.id;
    runData.cubeName = cube.name;

    const ts = Date.now();
    const bucket = getBucketName();

    await putObject(bucket, runKey(cube.id, ts), runData);

    const existingIndex: SimulationRunEntry[] = (await getObject(bucket, indexKey(cube.id))) ?? [];
    // Always use the server-generated timestamp — don't trust the client's generatedAt
    runData.generatedAt = new Date(ts).toISOString();

    const entry: SimulationRunEntry = {
      ts,
      generatedAt: runData.generatedAt,
      numDrafts: runData.numDrafts,
      numSeats: runData.numSeats,
      deadCardCount: Array.isArray(runData.deadCards) ? runData.deadCards.length : 0,
      convergenceScore: runData.convergenceScore ?? 0,
    };
    const updatedIndex = [entry, ...existingIndex].slice(0, MAX_HISTORY);
    const droppedEntries = existingIndex.slice(MAX_HISTORY - 1); // entries trimmed by the new addition

    await putObject(bucket, indexKey(cube.id), updatedIndex);

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
const getIndexHandler = async (req: Request, res: Response) => {
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

    if (runs.length === 0) {
      return res.status(200).json({ success: true, runs: [], latestRunData: null });
    }

    const latestRunData = await getObject(bucket, runKey(cube.id, runs[0]!.ts));
    return res.status(200).json({ success: true, runs, latestRunData: latestRunData ?? null });
  } catch (err) {
    req.logger.error(`Error in simulatesave GET index: ${err}`, err instanceof Error ? err.stack : '');
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /:id/:ts — load a specific historical run by its Unix-ms timestamp
const getRunHandler = async (req: Request, res: Response) => {
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
const deleteRunHandler = async (req: Request, res: Response) => {
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
      return res.status(403).json({ success: false, message: 'Only the cube owner or collaborators can delete simulation results' });
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

    await Promise.all([
      putObject(bucket, indexKey(cube.id), updatedRuns),
      deleteObject(bucket, runKey(cube.id, ts)),
    ]);

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
