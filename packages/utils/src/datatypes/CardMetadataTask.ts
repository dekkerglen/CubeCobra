import { BaseObject } from './BaseObject';

export enum CardMetadataTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface CardMetadataTask extends BaseObject {
  id: string;
  status: CardMetadataTaskStatus;
  timestamp: number; // Unix timestamp when the task was initiated
  step: string; // Current step in the metadata calculation process
  completedSteps: string[]; // Array of all completed steps in order
  stepTimestamps: Record<string, number>; // Map of step name to Unix timestamp when it started
  taskArn?: string; // ECS task ARN for monitoring task health
  errorMessage?: string; // Error message if status is FAILED
  startedAt?: number; // Unix timestamp when processing started
  completedAt?: number; // Unix timestamp when processing completed
  dateCreated: number;
  dateLastUpdated: number;
}

export interface NewCardMetadataTask {
  status: CardMetadataTaskStatus;
  step: string;
  errorMessage?: string;
}
