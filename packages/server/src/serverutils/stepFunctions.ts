/**
 * Calls into the ML retraining state machine (ML_PIPELINE_STATE_MACHINE_ARN): starting a training
 * run or a promotion, and resuming a run that waits for an admin's approval.
 */
import { SendTaskFailureCommand, SendTaskSuccessCommand, SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { RetrainMode } from '@utils/datatypes/RetrainTask';

import { stateMachineArn } from './mlRetraining';

export type PipelineInput =
  | { mode: RetrainMode.TRAIN; runId?: string }
  | { mode: RetrainMode.PROMOTE; version: string };

let client: SFNClient | null = null;

const sfn = (): SFNClient => {
  if (!client) {
    // arn:aws:states:<region>:<account>:stateMachine:<name>. Task tokens have to go back to the
    // region the execution runs in, whatever region this server's other clients use.
    const region = stateMachineArn()?.split(':')[3] || process.env.AWS_REGION || 'us-east-2';
    client = new SFNClient({ region });
  }
  return client;
};

/** Starts an execution and returns its ARN. */
export const startPipeline = async (name: string, input: PipelineInput): Promise<string | undefined> => {
  const arn = stateMachineArn();
  if (!arn) {
    throw new Error('ML_PIPELINE_STATE_MACHINE_ARN is not set');
  }
  const res = await sfn().send(new StartExecutionCommand({ stateMachineArn: arn, name, input: JSON.stringify(input) }));
  return res.executionArn;
};

export const approveRun = async (taskToken: string, userId: string): Promise<void> => {
  await sfn().send(new SendTaskSuccessCommand({ taskToken, output: JSON.stringify({ approved: true, by: userId }) }));
};

export const rejectRun = async (taskToken: string, username: string): Promise<void> => {
  await sfn().send(new SendTaskFailureCommand({ taskToken, error: 'Rejected', cause: `Rejected by ${username}` }));
};

/** The token no longer resumes anything: the wait timed out, the execution ended, or it was already used. */
export const isStaleTokenError = (err: unknown): boolean => {
  const name = (err as { name?: string } | undefined)?.name;
  return name === 'TaskTimedOut' || name === 'TaskDoesNotExist' || name === 'InvalidToken';
};
