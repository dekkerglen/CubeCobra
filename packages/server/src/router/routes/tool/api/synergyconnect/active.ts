import { synergyConnectPuzzleDao, synergyConnectSubmissionDao } from 'dynamo/daos';
import { toBoard } from 'serverutils/synergyconnect/board';

import { Request, Response } from '../../../../../types/express';

/**
 * The active puzzle as a playable board. Never includes group membership or
 * commander names for unsolved groups.
 */
export const getActiveSynergyConnectHandler = async (req: Request, res: Response) => {
  try {
    const puzzle = await synergyConnectPuzzleDao.getActive();
    if (!puzzle) {
      return res.status(404).json({ error: 'No active Synergy Connect puzzle' });
    }

    const submission = req.user
      ? ((await synergyConnectSubmissionDao.getByUserAndDate(req.user.id, puzzle.date)) ?? null)
      : null;

    return res.status(200).json({ success: true, board: toBoard(puzzle, submission), submission });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching active Synergy Connect puzzle' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getActiveSynergyConnectHandler],
  },
];
