import { synergyConnectPuzzleDao } from 'dynamo/daos';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';

export const getArchiveHandler = async (req: Request, res: Response) => {
  try {
    const limit = 30;
    const result = await synergyConnectPuzzleDao.getHistory(undefined, limit);

    return render(req, res, 'SynergyConnectArchivePage', {
      // Themes and dates only — groups stay server-side so past puzzles are
      // still playable.
      history: result.items.map((puzzle) => ({ date: puzzle.date, theme: puzzle.theme })),
      hasMore: !!result.lastKey,
      lastKey: result.lastKey ? JSON.stringify(result.lastKey) : null,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error loading Synergy Connect archive page:', error);
    req.flash('danger', 'Error loading Synergy Connect archive');
    return redirect(req, res, '/tool/synergyconnect');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getArchiveHandler],
  },
];
