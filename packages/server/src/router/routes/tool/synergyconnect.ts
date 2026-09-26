import { SYNERGY_CONNECT_MAX_MISTAKES, SynergyConnectPuzzle } from '@utils/datatypes/SynergyConnect';
import { synergyConnectPuzzleDao, synergyConnectSubmissionDao, synergyConnectUserStatsDao } from 'dynamo/daos';
import { isComplete, revealAll, toBoard } from 'serverutils/synergyconnect/board';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

const renderPuzzlePage = async (
  req: Request,
  res: Response,
  puzzle: SynergyConnectPuzzle | null,
  isArchive: boolean,
) => {
  let submission = null;
  let userStats = null;
  let revealed = null;

  if (puzzle && req.user) {
    const [foundSubmission, foundStats] = await Promise.all([
      synergyConnectSubmissionDao.getByUserAndDate(req.user.id, puzzle.date),
      synergyConnectUserStatsDao.getByUserId(req.user.id),
    ]);
    submission = foundSubmission ?? null;
    userStats = foundStats ?? null;

    // Once the game is over (solved or out of lives) the answers are no longer
    // a secret — ship them so a reload still shows the finished board.
    if (submission && (isComplete(submission) || submission.mistakes >= SYNERGY_CONNECT_MAX_MISTAKES)) {
      revealed = revealAll(puzzle);
    }
  }

  return render(req, res, 'SynergyConnectPage', {
    board: puzzle ? toBoard(puzzle, submission) : null,
    submission,
    userStats,
    revealed,
    isArchive,
  });
};

export const synergyConnectPageHandler = async (req: Request, res: Response) => {
  try {
    const puzzle = await synergyConnectPuzzleDao.getActive();
    return await renderPuzzlePage(req, res, puzzle ?? null, false);
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error loading Synergy Connect page:', error);
    req.flash('danger', 'Error loading Synergy Connect');
    return redirect(req, res, '/');
  }
};

export const synergyConnectDatePageHandler = async (req: Request, res: Response) => {
  try {
    const puzzle = await synergyConnectPuzzleDao.getByDate(req.params.date!);
    if (!puzzle) {
      req.flash('danger', 'No Synergy Connect puzzle exists for that date');
      return redirect(req, res, '/tool/synergyconnect');
    }

    return await renderPuzzlePage(req, res, puzzle, !puzzle.isActive);
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error loading Synergy Connect archive page:', error);
    req.flash('danger', 'Error loading Synergy Connect');
    return redirect(req, res, '/tool/synergyconnect');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [synergyConnectPageHandler],
  },
  {
    method: 'get',
    path: '/:date([0-9]{4}-[0-9]{2}-[0-9]{2})',
    handler: [synergyConnectDatePageHandler],
  },
];
