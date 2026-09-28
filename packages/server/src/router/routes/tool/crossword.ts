import { CrosswordPuzzle } from '@utils/datatypes/Crossword';
import { crosswordPuzzleDao, crosswordUserStatsDao } from 'dynamo/daos';
import { answerKey, toBoard } from 'serverutils/crossword/board';
import { startSession } from 'serverutils/crossword/daily';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

const renderPuzzlePage = async (req: Request, res: Response, puzzle: CrosswordPuzzle | null, isArchive: boolean) => {
  let submission = null;
  let userStats = null;
  let elapsedMs = null;
  let answers = null;

  if (puzzle && req.user) {
    // Opening the puzzle is what starts the clock, so this is a write on a page
    // load — once per user per puzzle, and only ever the first time.
    const [foundSubmission, foundStats] = await Promise.all([
      startSession(req.user.id, puzzle.date),
      crosswordUserStatsDao.getByUserId(req.user.id),
    ]);
    submission = foundSubmission;
    userStats = foundStats ?? null;
    elapsedMs = Math.max(0, Date.now() - submission.startedAt);

    // Once it's solved the answers aren't a secret, so a reload can show the
    // finished grid and what every entry was.
    if (submission.solved) {
      answers = answerKey(puzzle);
    }
  }

  return render(req, res, 'CrosswordPage', {
    // toBoard is the answer boundary: shape, numbering and clues, no letters.
    board: puzzle ? toBoard(puzzle) : null,
    submission,
    userStats,
    elapsedMs,
    answers,
    isArchive,
  });
};

export const crosswordPageHandler = async (req: Request, res: Response) => {
  try {
    const puzzle = await crosswordPuzzleDao.getActive();
    return await renderPuzzlePage(req, res, puzzle ?? null, false);
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error loading crossword page:', error);
    req.flash('danger', 'Error loading the crossword');
    return redirect(req, res, '/');
  }
};

export const crosswordDatePageHandler = async (req: Request, res: Response) => {
  try {
    const puzzle = await crosswordPuzzleDao.getByDate(req.params.date!);
    if (!puzzle) {
      req.flash('danger', 'No crossword exists for that date');
      return redirect(req, res, '/tool/crossword');
    }

    return await renderPuzzlePage(req, res, puzzle, !puzzle.isActive);
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error loading crossword archive page:', error);
    req.flash('danger', 'Error loading the crossword');
    return redirect(req, res, '/tool/crossword');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [crosswordPageHandler],
  },
  {
    method: 'get',
    path: '/:date([0-9]{4}-[0-9]{2}-[0-9]{2})',
    handler: [crosswordDatePageHandler],
  },
];
