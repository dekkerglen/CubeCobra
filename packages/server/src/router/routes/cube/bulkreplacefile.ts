import Cube from 'dynamo/models/cube';
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

    const cube = await Cube.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    // use this to maintain customized fields
    const cards = await Cube.getCards(cube.id);

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

      const changelog = {
        mainboard: {
          adds: newList.mainboard.map(({ cardID }: any) => ({ cardID })),
          removes: cards.mainboard.map(({ cardID }: any) => ({ oldCard: { cardID } })),
        },
        maybeboard: {
          adds: newList.maybeboard.map(({ cardID }: any) => ({ cardID })),
          removes: cards.maybeboard.map(({ cardID }: any) => ({ oldCard: { cardID } })),
        },
      };

      added.push(...newList.mainboard);

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
