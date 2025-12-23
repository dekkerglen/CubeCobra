import { cubeDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';
import { cardFromId } from 'serverutils/carddb';
import { updateCubeAndBlog } from 'serverutils/cube';
import { CSVtoCards, isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const bulkReplaceFileHandler = async (req: Request, res: Response) => {
  try {
    const split = req.body.file.split(',');
    const encodedFile = split[1];

    // decode base64
    const items = Buffer.from(encodedFile, 'base64').toString('utf8');

    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    // use this to maintain customized fields
    const cards = await cubeDao.getCards(cube.id);

    if (cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
    }

    const lines = items.match(/[^\r\n]+/g);

    if (lines && (lines[0].match(/,/g) || []).length > 3) {
      const added: any[] = [];
      const { newCards, newMaybe, missing } = CSVtoCards(items);

      const newList = {
        mainboard: newCards.map((card: any) => ({
          details: cardFromId(card.cardID),
          ...card,
        })),
        maybeboard: newMaybe.map((card: any) => ({
          details: cardFromId(card.cardID),
          ...card,
        })),
      };

      // Calculate delta for mainboard
      const currentMainboardIds = new Map(cards.mainboard.map((c, idx) => [c.cardID, { card: c, index: idx }]));
      const newMainboardIds = new Set(newList.mainboard.map((c) => c.cardID));

      const mainboardAdds = newList.mainboard.filter((c) => !currentMainboardIds.has(c.cardID));
      const mainboardRemoves = cards.mainboard
        .filter((c) => !newMainboardIds.has(c.cardID))
        .map((c) => {
          const info = currentMainboardIds.get(c.cardID);
          return {
            index: info?.index ?? 0,
            oldCard: c,
          };
        });

      // Calculate delta for maybeboard
      const currentMaybeIds = new Map(cards.maybeboard.map((c, idx) => [c.cardID, { card: c, index: idx }]));
      const newMaybeIds = new Set(newList.maybeboard.map((c) => c.cardID));

      const maybeAdds = newList.maybeboard.filter((c) => !currentMaybeIds.has(c.cardID));
      const maybeRemoves = cards.maybeboard
        .filter((c) => !newMaybeIds.has(c.cardID))
        .map((c) => {
          const info = currentMaybeIds.get(c.cardID);
          return {
            index: info?.index ?? 0,
            oldCard: c,
          };
        });

      const changelog = {
        mainboard: {
          adds: mainboardAdds.length > 0 ? mainboardAdds : undefined,
          removes: mainboardRemoves.length > 0 ? mainboardRemoves : undefined,
        },
        maybeboard: {
          adds: maybeAdds.length > 0 ? maybeAdds : undefined,
          removes: maybeRemoves.length > 0 ? maybeRemoves : undefined,
        },
      };

      // Check if there are any changes
      const hasChanges =
        mainboardAdds.length > 0 || mainboardRemoves.length > 0 || maybeAdds.length > 0 || maybeRemoves.length > 0;

      if (!hasChanges) {
        req.flash(
          'danger',
          'The uploaded file contains the same cards as your current cube list. No changes were made. Please upload a file with different cards to update your cube.',
        );
        return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
      }

      added.push(...mainboardAdds);

      return updateCubeAndBlog(req, res, cube, cards, newList as any, changelog as any, added, missing);
    }

    throw new Error('Received empty file');
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/list/${req.params.id}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post' as const,
    handler: [ensureAuth, bulkReplaceFileHandler],
  },
];
