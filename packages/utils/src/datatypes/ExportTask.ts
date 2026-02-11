import { BaseObject } from './BaseObject';

export enum ExportTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ExportTask extends BaseObject {
  id: string;
  status: ExportTaskStatus;
  timestamp: number; // Unix timestamp when the task was initiated
  exportType: string; // Type of export (e.g., 'all_cards', 'cube_data')
  fileSize: number; // File size in bytes of the generated export
  step: string; // Current step in the export process (e.g., 'Downloading', 'Processing', 'Uploading')
  completedSteps: string[]; // Array of all completed steps in order
  stepTimestamps: Record<string, number>; // Map of step name to Unix timestamp when it started
  taskArn?: string; // ECS task ARN for monitoring task health
  errorMessage?: string; // Error message if status is FAILED
  startedAt?: number; // Unix timestamp when processing started
  completedAt?: number; // Unix timestamp when processing completed
  dateCreated: number;
  dateLastUpdated: number;
}

export interface NewExportTask {
  status: ExportTaskStatus;
  exportType: string;
  fileSize: number;
  step: string;
  errorMessage?: string;
}
