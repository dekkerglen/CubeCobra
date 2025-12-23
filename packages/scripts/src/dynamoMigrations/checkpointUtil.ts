import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility for managing migration checkpoints.
 * Allows migrations to resume from where they left off if interrupted.
 */

interface CheckpointData {
  lastKey?: Record<string, any>;
  stats: Record<string, number>;
  timestamp: number;
  batchNumber: number;
}

export class CheckpointManager {
  private checkpointPath: string;

  constructor(migrationName: string) {
    const checkpointDir = path.join(process.cwd(), '.migration-checkpoints');
    if (!fs.existsSync(checkpointDir)) {
      fs.mkdirSync(checkpointDir, { recursive: true });
    }
    this.checkpointPath = path.join(checkpointDir, `${migrationName}.json`);
  }

  /**
   * Save checkpoint data to disk
   */
  save(data: CheckpointData): void {
    try {
      fs.writeFileSync(this.checkpointPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Failed to save checkpoint:', error);
    }
  }

  /**
   * Load checkpoint data from disk
   */
  load(): CheckpointData | null {
    try {
      if (fs.existsSync(this.checkpointPath)) {
        const data = fs.readFileSync(this.checkpointPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load checkpoint:', error);
    }
    return null;
  }

  /**
   * Clear checkpoint file
   */
  clear(): void {
    try {
      if (fs.existsSync(this.checkpointPath)) {
        fs.unlinkSync(this.checkpointPath);
      }
    } catch (error) {
      console.warn('Failed to clear checkpoint:', error);
    }
  }

  /**
   * Check if checkpoint exists
   */
  exists(): boolean {
    return fs.existsSync(this.checkpointPath);
  }
}
