// Last step of export-all: marks the export complete and starts a retraining run on it.
//
// export/manifest.json records when the export finished; retraining counts its 3-year data window
// back from that date. In production ML_PIPELINE_STATE_MACHINE_ARN is set and a run starts here,
// named after the export so a retried finalize can't start a second one. A failure to start the run
// doesn't fail the export: admins can start a run from the admin page.
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { exportTaskDao } from '@server/dynamo/daos';
import { newRunId } from '@utils/ml/modelBundle';

import { getPublicBucket } from './utils/s3';
import { writeJson } from './ml/s3';

const taskId = process.env.EXPORT_TASK_ID;

(async () => {
  if (taskId) {
    await exportTaskDao.updateStep(taskId, 'Finalizing export');
  }

  const exportedAt = Date.now();
  await writeJson(getPublicBucket(), 'export/manifest.json', { exportedAt, exportTaskId: taskId ?? null });
  console.log(`Export finished at ${new Date(exportedAt).toISOString()}`);

  const stateMachineArn = process.env.ML_PIPELINE_STATE_MACHINE_ARN;
  if (stateMachineArn) {
    const runId = newRunId(new Date(exportedAt));
    try {
      const sfn = new SFNClient({ region: process.env.AWS_REGION });
      const { executionArn } = await sfn.send(
        new StartExecutionCommand({
          stateMachineArn,
          name: `export-${taskId ?? runId}`,
          input: JSON.stringify({ mode: 'train', runId, exportedAt }),
        }),
      );
      console.log(`Started retraining run ${runId}: ${executionArn}`);
    } catch (error: any) {
      if (error?.name === 'ExecutionAlreadyExists') {
        console.log('A retraining run for this export already exists');
      } else {
        console.error('Could not start the retraining run:', error);
      }
    }
  }

  process.exit(0);
})().catch(async (error) => {
  console.error('Finalizing the export failed:', error);
  if (taskId) {
    await exportTaskDao.markAsFailed(taskId, error instanceof Error ? error.message : 'Unknown error finalizing export');
  }
  process.exit(1);
});
