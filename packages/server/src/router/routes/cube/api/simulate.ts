import Card from '@utils/datatypes/Card';
import { cubeDao } from 'dynamo/daos';
import Joi from 'joi';
import { isCubeViewable } from 'serverutils/cubefn';
import { runSimulation } from 'serverutils/draftSimulator';
import { createJob, getJob, hasActiveJob, updateJob } from 'serverutils/simulationJobs';

import { Request, Response } from '../../../../types/express';

const StartSimulationSchema = Joi.object({
  numDrafts: Joi.number().integer().min(1).max(500).default(100),
  numSeats: Joi.number().integer().min(2).max(16).default(8),
  deadCardThreshold: Joi.number().min(0).max(1).default(0.05),
});

const startSimulationHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.id;
    if (!cubeId) {
      return res.status(400).json({ success: false, message: 'Cube ID required' });
    }

    const cube = await cubeDao.getById(cubeId);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found' });
    }

    const { error, value } = StartSimulationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const { numDrafts, numSeats, deadCardThreshold } = value;

    if (hasActiveJob(cubeId)) {
      return res
        .status(409)
        .json({ success: false, message: 'A simulation is already running for this cube' });
    }

    const cubeCards = await cubeDao.getCards(cube.id);
    const boardCards: Record<string, Card[]> = {};
    for (const [key, cards] of Object.entries(cubeCards)) {
      if (key !== 'id' && Array.isArray(cards)) {
        boardCards[key] = cards as Card[];
      }
    }

    // Track jobs by the public cube identifier used in the route so status polls
    // match whether the cube was loaded by shortId or canonical id.
    const job = createJob(cubeId);

    // Fire-and-forget: run simulation asynchronously
    runSimulation(cube, boardCards, { numDrafts, numSeats, deadCardThreshold }, (progress) => {
      updateJob(job.id, { status: 'running', progress });
    })
      .then((result) => {
        updateJob(job.id, { status: 'completed', result });
      })
      .catch((err: Error) => {
        updateJob(job.id, { status: 'failed', error: err.message });
      });

    return res.status(202).json({ success: true, jobId: job.id });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getSimulationStatusHandler = async (req: Request, res: Response) => {
  try {
    const job = getJob(req.params.jobId!);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Verify the job belongs to this cube
    if (job.cubeId !== req.params.id) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    return res.status(200).json({ success: true, job });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [startSimulationHandler],
  },
  {
    method: 'get',
    path: '/:id/:jobId',
    handler: [getSimulationStatusHandler],
  },
];
