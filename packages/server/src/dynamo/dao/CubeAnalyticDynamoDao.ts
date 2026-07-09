/**
 * CubeAnalyticDynamoDao - Data Access Object for CubeAnalytic entities.
 *
 * STORAGE STRATEGY:
 * - CubeAnalytic data: Stored in S3 at cube_analytic/{cubeId}.json
 * - No metadata stored in DynamoDB (analytics are purely data files)
 *
 * QUERY PATTERNS:
 * - getByCube(cubeId): Get analytics for a specific cube
 * - batchPut(analytics): Batch update analytics for multiple cubes
 * - put(cubeId, analytic): Update analytics for a single cube
 *
 * STRUCTURE:
 * Each cube's analytics contains:
 * - cube: The cube ID
 * - cards: Array of card analytics (picks, passes, elo, mainboards, sideboards)
 * - useCubeElo: Optional flag for whether to use cube-specific elo
 */

import CubeAnalytic from '@utils/datatypes/CubeAnalytic';

import { deleteObject, getObject, putObject } from '../s3client';

export interface CubeAnalyticBatch {
  [cubeId: string]: CubeAnalytic;
}

export class CubeAnalyticDynamoDao {
  constructor() {}

  /**
   * Gets analytics for a specific cube from S3.
   *
   * @param cubeId - The ID of the cube to get analytics for
   * @returns The cube analytics, or an empty object if not found
   */
  public async getByCube(cubeId: string): Promise<CubeAnalytic | Record<string, never>> {
    try {
      return await getObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`);
    } catch {
      // Return empty object if analytics don't exist
      return {};
    }
  }

  /**
   * Updates analytics for a single cube in S3.
   *
   * @param cubeId - The ID of the cube
   * @param analytic - The analytics data to save
   */
  public async put(cubeId: string, analytic: CubeAnalytic): Promise<void> {
    await putObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`, analytic);
  }

  /**
   * Batch updates analytics for multiple cubes in S3.
   * Processes all cubes in parallel for efficiency.
   *
   * @param analytics - Dictionary mapping cube IDs to their analytics
   */
  public async batchPut(analytics: CubeAnalyticBatch): Promise<void> {
    await Promise.all(
      Object.keys(analytics).map(async (cubeId) => {
        await putObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`, analytics[cubeId]);
      }),
    );
  }

  /**
   * Deletes analytics for a specific cube from S3.
   * Note: This is a soft delete - the file is removed but no metadata is updated.
   *
   * @param cubeId - The ID of the cube to delete analytics for
   */
  public async deleteByCube(cubeId: string): Promise<void> {
    await deleteObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`);
  }

  /**
   * Checks if analytics exist for a specific cube.
   *
   * @param cubeId - The ID of the cube to check
   * @returns True if analytics exist, false otherwise
   */
  public async exists(cubeId: string): Promise<boolean> {
    try {
      await getObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`);
      return true;
    } catch {
      return false;
    }
  }
}
