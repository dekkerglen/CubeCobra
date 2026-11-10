import type { GateMetrics } from '../ml/modelBundle';
import { BaseObject } from './BaseObject';

export enum RetrainTaskStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

export enum RetrainMode {
  // Full run: process the export, train, evaluate, publish, promote (with approval).
  TRAIN = 'train',
  // Promote an already-published version (rollback or re-promotion); no training.
  PROMOTE = 'promote',
}

export type PromotionTarget = 'beta' | 'production';

export interface RetrainGate {
  passed: boolean;
  reasons: string[];
  candidate: GateMetrics;
  live: GateMetrics | null;
  liveVersion: string | null;
  archetypeShift?: number;
}

// One execution of the ML retraining state machine. id is the run id (see newRunId), which is
// also the model version a TRAIN run publishes.
export interface RetrainTask extends BaseObject {
  id: string;
  mode: RetrainMode;
  status: RetrainTaskStatus;
  timestamp: number; // when the run started
  step: string;
  completedSteps: string[];
  stepTimestamps: Record<string, number>;
  executionArn?: string;
  version: string; // the version this run publishes (TRAIN) or promotes (PROMOTE)
  previousVersion?: string; // production version before this run promoted, for rollback
  exportedAt?: number;
  gate?: RetrainGate;
  promotedTo: PromotionTarget[];
  // Step Functions task token while AWAITING_APPROVAL; cleared once an admin decides.
  taskToken?: string;
  decidedBy?: string; // admin user id who approved or rejected
  errorMessage?: string;
  // Set when an admin dismisses a failed run's alert.
  acknowledged?: boolean;
  completedAt?: number;
  dateCreated: number;
  dateLastUpdated: number;
}

export interface NewRetrainTask {
  id: string;
  mode: RetrainMode;
  version: string;
  executionArn?: string;
  exportedAt?: number;
}
