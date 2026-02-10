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

      // Calculate delta for mainboard - handles cubes with multiple copies of the same card
      const currentMainboardCounts = new Map<string, number>();
      const newMainboardCounts = new Map<string, number>();

      cards.mainboard.forEach((c) => {
        currentMainboardCounts.set(c.cardID, (currentMainboardCounts.get(c.cardID) || 0) + 1);
      });

      newList.mainboard.forEach((c) => {
        newMainboardCounts.set(c.cardID, (newMainboardCounts.get(c.cardID) || 0) + 1);
      });

      // Get all unique cardIDs from both lists
      const allMainboardCardIDs = new Set([...currentMainboardCounts.keys(), ...newMainboardCounts.keys()]);

      const mainboardAdds: any[] = [];
      const mainboardRemoves: any[] = [];

      allMainboardCardIDs.forEach((cardID) => {
        const currentCount = currentMainboardCounts.get(cardID) || 0;
        const newCount = newMainboardCounts.get(cardID) || 0;
        const diff = newCount - currentCount;

        if (diff > 0) {
          // Need to add copies
          const newCard = newList.mainboard.find((c) => c.cardID === cardID);
          for (let i = 0; i < diff; i++) {
            mainboardAdds.push(newCard);
          }
        } else if (diff < 0) {
          // Need to remove copies - remove from the end to preserve earlier customizations
          const cardsToRemove = cards.mainboard
            .map((c, idx) => ({ card: c, index: idx }))
            .filter((item) => item.card.cardID === cardID)
            .slice(currentCount + diff, currentCount); // Take the last |diff| cards with this ID

          cardsToRemove.forEach((item) => {
            mainboardRemoves.push({
              index: item.index,
              oldCard: item.card,
            });
          });
        }
      });

      // Calculate delta for maybeboard - handles cubes with multiple copies of the same card
      const currentMaybeCounts = new Map<string, number>();
      const newMaybeCounts = new Map<string, number>();

      cards.maybeboard.forEach((c) => {
        currentMaybeCounts.set(c.cardID, (currentMaybeCounts.get(c.cardID) || 0) + 1);
      });

      newList.maybeboard.forEach((c) => {
        newMaybeCounts.set(c.cardID, (newMaybeCounts.get(c.cardID) || 0) + 1);
      });

      // Get all unique cardIDs from both lists
      const allMaybeCardIDs = new Set([...currentMaybeCounts.keys(), ...newMaybeCounts.keys()]);

      const maybeAdds: any[] = [];
      const maybeRemoves: any[] = [];

      allMaybeCardIDs.forEach((cardID) => {
        const currentCount = currentMaybeCounts.get(cardID) || 0;
        const newCount = newMaybeCounts.get(cardID) || 0;
        const diff = newCount - currentCount;

        if (diff > 0) {
          // Need to add copies
          const newCard = newList.maybeboard.find((c) => c.cardID === cardID);
          for (let i = 0; i < diff; i++) {
            maybeAdds.push(newCard);
          }
        } else if (diff < 0) {
          // Need to remove copies - remove from the end to preserve earlier customizations
          const cardsToRemove = cards.maybeboard
            .map((c, idx) => ({ card: c, index: idx }))
            .filter((item) => item.card.cardID === cardID)
            .slice(currentCount + diff, currentCount); // Take the last |diff| cards with this ID

          cardsToRemove.forEach((item) => {
            maybeRemoves.push({
              index: item.index,
              oldCard: item.card,
            });
          });
        }
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
