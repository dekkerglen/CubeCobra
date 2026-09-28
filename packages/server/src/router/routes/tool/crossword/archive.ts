import { crosswordPuzzleDao } from 'dynamo/daos';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';

export const getArchiveHandler = async (req: Request, res: Response) => {
  try {
    const limit = 30;
    const result = await crosswordPuzzleDao.getHistory(undefined, limit);

    return render(req, res, 'CrosswordArchivePage', {
      // Dates and sizes only — the grids stay server-side so past puzzles are
      // still playable.
      history: result.items.map((puzzle) => ({
        date: puzzle.date,
        size: puzzle.grid.width,
        slots: puzzle.grid.slots.length,
      })),
      hasMore: !!result.lastKey,
      lastKey: result.lastKey ? JSON.stringify(result.lastKey) : null,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error loading crossword archive page:', error);
    req.flash('danger', 'Error loading the crossword archive');
    return redirect(req, res, '/tool/crossword');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getArchiveHandler],
  },
];
