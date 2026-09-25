import { ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';
import {
  manaMatrixCellStatsDao,
  manaMatrixPuzzleDao,
  manaMatrixSubmissionDao,
  manaMatrixUserStatsDao,
} from 'dynamo/daos';
import { countedNamesGrid, popularityGrid } from 'serverutils/manamatrix/popularity';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

const renderPuzzlePage = async (req: Request, res: Response, puzzle: ManaMatrixPuzzle | null, isArchive: boolean) => {
  let submission = null;
  let userStats = null;
  let popularity = null;

  if (puzzle && req.user) {
    const [foundSubmission, foundStats] = await Promise.all([
      manaMatrixSubmissionDao.getByUserAndDate(req.user.id, puzzle.date),
      manaMatrixUserStatsDao.getByUserId(req.user.id),
    ]);
    submission = foundSubmission ?? null;
    userStats = foundStats ?? null;

    // Only pull the answer tallies when the user has counted answers to show.
    if (submission && Object.keys(submission.countedCells).length > 0) {
      const cellStats = await manaMatrixCellStatsDao.getForPuzzle(puzzle.date);
      popularity = popularityGrid(cellStats, countedNamesGrid(submission));
    }
  }

  return render(req, res, 'ManaMatrixPage', {
    puzzle,
    submission,
    userStats,
    popularity,
    isArchive,
  });
};

export const manaMatrixPageHandler = async (req: Request, res: Response) => {
  try {
    const puzzle = await manaMatrixPuzzleDao.getActive();
    return await renderPuzzlePage(req, res, puzzle ?? null, false);
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error loading ManaMatrix page:', error);
    req.flash('danger', 'Error loading ManaMatrix');
    return redirect(req, res, '/');
  }
};

export const manaMatrixDatePageHandler = async (req: Request, res: Response) => {
  try {
    const puzzle = await manaMatrixPuzzleDao.getByDate(req.params.date!);
    if (!puzzle) {
      req.flash('danger', 'No ManaMatrix puzzle exists for that date');
      return redirect(req, res, '/tool/manamatrix');
    }

    return await renderPuzzlePage(req, res, puzzle, !puzzle.isActive);
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error loading ManaMatrix archive page:', error);
    req.flash('danger', 'Error loading ManaMatrix');
    return redirect(req, res, '/tool/manamatrix');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [manaMatrixPageHandler],
  },
  {
    method: 'get',
    path: '/:date([0-9]{4}-[0-9]{2}-[0-9]{2})',
    handler: [manaMatrixDatePageHandler],
  },
];
