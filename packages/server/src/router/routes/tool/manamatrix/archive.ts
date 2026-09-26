import { manaMatrixPuzzleDao } from 'dynamo/daos';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';

export const getArchiveHandler = async (req: Request, res: Response) => {
  try {
    const limit = 30;
    const result = await manaMatrixPuzzleDao.getHistory(undefined, limit);

    return render(req, res, 'ManaMatrixArchivePage', {
      history: result.items,
      hasMore: !!result.lastKey,
      lastKey: result.lastKey ? JSON.stringify(result.lastKey) : null,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error loading ManaMatrix archive page:', error);
    req.flash('danger', 'Error loading Mana Matrix archive');
    return redirect(req, res, '/tool/manamatrix');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getArchiveHandler],
  },
];
