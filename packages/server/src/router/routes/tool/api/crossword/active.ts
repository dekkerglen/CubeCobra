import { crosswordPuzzleDao } from 'dynamo/daos';
import { answerKey, toBoard } from 'serverutils/crossword/board';
import { startSession } from 'serverutils/crossword/daily';

import { Request, Response } from '../../../../../types/express';

/**
 * The active puzzle as a playable board: geometry, numbering and clues, never a
 * letter. Fetching it is what starts a logged-in player's clock, since opening the
 * puzzle is when they started solving it.
 */
export const getActiveCrosswordHandler = async (req: Request, res: Response) => {
  try {
    const puzzle = await crosswordPuzzleDao.getActive();
    if (!puzzle) {
      return res.status(404).json({ error: 'No active crossword puzzle' });
    }

    const submission = req.user ? await startSession(req.user.id, puzzle.date) : null;

    return res.status(200).json({
      success: true,
      board: toBoard(puzzle),
      submission,
      // Computed here rather than from `startedAt` on the client, so a clock skewed
      // against the server's doesn't shift the displayed time.
      elapsedMs: submission ? Math.max(0, Date.now() - submission.startedAt) : null,
      answers: submission?.solved ? answerKey(puzzle) : null,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching active crossword puzzle' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getActiveCrosswordHandler],
  },
];
