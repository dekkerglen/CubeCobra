import { BaseObject } from './BaseObject';

export enum MigrationTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface MigrationTask extends BaseObject {
  id: string;
  status: MigrationTaskStatus;
  timestamp: number; // Unix timestamp when the task was initiated
  lastMigrationDate: string; // ISO 8601 timestamp of the last migration processed
  migrationsProcessed: number; // Number of migrations processed in this run
  cubesAffected: number; // Number of cubes that were updated
  cardsDeleted: number; // Number of card entries deleted
  cardsMerged: number; // Number of card entries merged/updated
  step: string; // Current step in the migration process
  completedSteps: string[]; // Array of all completed steps in order
  stepTimestamps: Record<string, number>; // Map of step name to Unix timestamp when it started
  taskArn?: string; // ECS task ARN for monitoring task health
  errorMessage?: string; // Error message if status is FAILED
  startedAt?: number; // Unix timestamp when processing started
  completedAt?: number; // Unix timestamp when processing completed
  dateCreated: number;
  dateLastUpdated: number;
}

export interface NewMigrationTask {
  status: MigrationTaskStatus;
  lastMigrationDate: string;
  migrationsProcessed: number;
  cubesAffected: number;
  cardsDeleted: number;
  cardsMerged: number;
  step: string;
  errorMessage?: string;
}
