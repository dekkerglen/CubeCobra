import { rotateQueue } from './jobs/rotateFeaturedQueue';
import { syncPodcasts } from './jobs/syncPodcasts';
import { rotateP1P1 } from './jobs/rotateDailyP1P1';

const DAILY_JOBS = [
  { name: 'syncPodcasts', fn: syncPodcasts },
  { name: 'rotateDailyP1P1', fn: rotateP1P1 },
];

const WEEKLY_JOBS = [{ name: 'rotateFeaturedQueue', fn: rotateQueue }];

export const handler = async (event: any) => {
  console.log('Daily jobs lambda triggered', { event });

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  try {
    // Run daily jobs
    console.log('Running daily jobs...');
    await Promise.all(DAILY_JOBS.map((job) => job.fn()));
    console.log('Daily jobs completed successfully');

    // Run weekly jobs (Sunday only)
    if (dayOfWeek === 0) {
      console.log('Running weekly jobs (Sunday)...');
      await Promise.all(WEEKLY_JOBS.map((job) => job.fn()));
      console.log('Weekly jobs completed successfully');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Jobs completed successfully',
        timestamp: now.toISOString(),
        jobsRun: {
          daily: DAILY_JOBS.map((job) => job.name),
          weekly: dayOfWeek === 0 ? WEEKLY_JOBS.map((job) => job.name) : [],
        },
      }),
    };
  } catch (error) {
    console.error('Error running jobs:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error running jobs',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: now.toISOString(),
      }),
    };
  }
};
