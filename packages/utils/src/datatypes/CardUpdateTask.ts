import { BaseObject } from './BaseObject';

export enum CardUpdateTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface CardUpdateTask extends BaseObject {
  id: string;
  status: CardUpdateTaskStatus;
  timestamp: number; // Unix timestamp when the task was initiated
  checksum: string; // SHA-256 checksum of all_cards.json
  scryfallUpdatedAt: string; // ISO 8601 timestamp from Scryfall API (when they last updated the data)
  scryfallFileSize: number; // File size in bytes from Scryfall API
  cardsAdded: number; // Number of cards added in this update
  cardsRemoved: number; // Number of cards removed in this update
  totalCards: number; // Total number of cards after this update
  step: string; // Current step in the update process (e.g., 'Downloading', 'Processing', 'Uploading')
  completedSteps: string[]; // Array of all completed steps in order
  stepTimestamps: Record<string, number>; // Map of step name to Unix timestamp when it started
  taskArn?: string; // ECS task ARN for monitoring task health
  errorMessage?: string; // Error message if status is FAILED
  startedAt?: number; // Unix timestamp when processing started
  completedAt?: number; // Unix timestamp when processing completed
  dateCreated: number;
  dateLastUpdated: number;
}

export interface NewCardUpdateTask {
  status: CardUpdateTaskStatus;
  checksum: string;
  scryfallUpdatedAt: string;
  scryfallFileSize: number;
  cardsAdded: number;
  cardsRemoved: number;
  totalCards: number;
  step: string;
  errorMessage?: string;
}
