import { ManaMatrixPuzzle, ManaMatrixSubmission } from '@utils/datatypes/ManaMatrix';
import { manaMatrixPuzzleDao, manaMatrixSubmissionDao } from 'dynamo/daos';

interface Logger {
  error: (message: string, error: any) => void;
}

export interface DailyManaMatrixResult {
  puzzle: ManaMatrixPuzzle;
  // The viewer's progress on today's puzzle, when logged in and they've played.
  submission: ManaMatrixSubmission | null;
}

/**
 * Fetches today's ManaMatrix puzzle (and the viewer's progress, if any) for the
 * dashboard/landing teasers. Optional content: never throws, returns null when
 * unavailable.
 */
export const getDailyManaMatrix = async (logger?: Logger, userId?: string): Promise<DailyManaMatrixResult | null> => {
  try {
    const puzzle = await manaMatrixPuzzleDao.getActive();
    if (!puzzle) {
      return null;
    }

    const submission = userId ? ((await manaMatrixSubmissionDao.getByUserAndDate(userId, puzzle.date)) ?? null) : null;

    return { puzzle, submission };
  } catch (err) {
    if (logger) {
      logger.error('Error loading daily ManaMatrix:', err);
    }
    return null;
  }
};

export default { getDailyManaMatrix };
