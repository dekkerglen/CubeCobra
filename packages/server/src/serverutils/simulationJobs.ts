import crypto from 'crypto';

import { SimulationJob } from '@utils/datatypes/HealthReport';

const jobs = new Map<string, SimulationJob>();
const STALE_JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const createJob = (cubeId: string): SimulationJob => {
  cleanupStaleJobs();

  const job: SimulationJob = {
    id: crypto.randomUUID(),
    status: 'pending',
    progress: null,
    result: null,
    error: null,
    createdAt: Date.now(),
    cubeId,
  };

  jobs.set(job.id, job);
  return job;
};

export const getJob = (jobId: string): SimulationJob | undefined => {
  return jobs.get(jobId);
};

export const updateJob = (jobId: string, updates: Partial<SimulationJob>): void => {
  const job = jobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
  }
};

export const hasActiveJob = (cubeId: string): boolean => {
  for (const job of jobs.values()) {
    if (job.cubeId === cubeId && (job.status === 'pending' || job.status === 'running')) {
      return true;
    }
  }
  return false;
};

export const cleanupStaleJobs = (): void => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > STALE_JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
};
