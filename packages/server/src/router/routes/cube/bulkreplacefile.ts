import { isCustomOrVoucher } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { cubeDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';
import { cardFromId } from 'serverutils/carddb';
import { CSVtoCards, isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

/**
 * Identity key for delta computation. Normal cards collapse by cardID
 * (scryfall_id). Custom/voucher cards all share the same sentinel cardID,
 * so we additionally key on the user-provided name — otherwise every custom
 * card in a CSV gets treated as a duplicate of the first one and ends up
 * copying its characteristics.
 */
function cardDeltaKey(card: Card): string {
  if (isCustomOrVoucher(card)) {
    const name = ((card as any).custom_name || (card as any).name || '').toLowerCase();
    return `${card.cardID}::${name}`;
  }
  return card.cardID;
}

/**
 * Compute adds/removes delta between current and new card lists for a single board.
 * Handles multiple copies of the same card correctly.
 */
function computeBoardDelta(currentCards: Card[], newCards: Card[]): { adds: any[]; removes: any[] } {
  const currentCounts = new Map<string, number>();
  const newCounts = new Map<string, number>();

  currentCards.forEach((c) => {
    const k = cardDeltaKey(c);
    currentCounts.set(k, (currentCounts.get(k) || 0) + 1);
  });

  newCards.forEach((c) => {
    const k = cardDeltaKey(c);
    newCounts.set(k, (newCounts.get(k) || 0) + 1);
  });

  const allKeys = new Set([...currentCounts.keys(), ...newCounts.keys()]);
  const adds: any[] = [];
  const removes: any[] = [];

  allKeys.forEach((key) => {
    const currentCount = currentCounts.get(key) || 0;
    const newCount = newCounts.get(key) || 0;
    const diff = newCount - currentCount;

    if (diff > 0) {
      const newCard = newCards.find((c) => cardDeltaKey(c) === key);
      for (let i = 0; i < diff; i++) {
        adds.push(newCard);
      }
    } else if (diff < 0) {
      const cardsToRemove = currentCards
        .map((c, idx) => ({ card: c, index: idx }))
        .filter((item) => cardDeltaKey(item.card) === key)
        .slice(currentCount + diff, currentCount);

      cardsToRemove.forEach((item) => {
        removes.push({
          index: item.index,
          oldCard: item.card,
        });
      });
    }
  });

  return { adds, removes };
}

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

    if (!isCubeEditable(cube, req.user)) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
    }

    const lines = items.match(/[^\r\n]+/g);

    if (lines && (lines[0].match(/,/g) || []).length > 3) {
      const { cardsByBoard, missing } = CSVtoCards(items);

      // Build the new card list from cardsByBoard, adding details
      const newList: Record<string, Card[]> = {};
      for (const [boardName, boardCards] of Object.entries(cardsByBoard)) {
        newList[boardName] = boardCards.map((card: any) => ({
          details: cardFromId(card.cardID),
          ...card,
        }));
      }

      // Collect all board names from both current cards and new cards
      const allBoardNames = new Set<string>();
      for (const [key, val] of Object.entries(cards)) {
        if (key !== 'id' && Array.isArray(val)) {
          allBoardNames.add(key);
        }
      }
      for (const key of Object.keys(newList)) {
        allBoardNames.add(key);
      }

      // Compute delta for each board
      const changelog: Record<string, any> = {};
      let hasChanges = false;

      for (const boardName of allBoardNames) {
        const currentBoardCards = (cards as any)[boardName] || [];
        const newBoardCards = newList[boardName] || [];

        const { adds, removes } = computeBoardDelta(
          Array.isArray(currentBoardCards) ? currentBoardCards : [],
          newBoardCards,
        );

        if (adds.length > 0 || removes.length > 0) {
          hasChanges = true;
          changelog[boardName] = {
            adds: adds.length > 0 ? adds : undefined,
            removes: removes.length > 0 ? removes : undefined,
          };
        }
      }

      if (!hasChanges) {
        req.flash(
          'danger',
          'The uploaded file contains the same cards as your current cube list. No changes were made. Please upload a file with different cards to update your cube.',
        );
        return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
      }

      // Route to the confirmation page so the user can review adds AND removes
      return render(req, res, 'BulkUploadPage', {
        cube,
        cards,
        canEdit: true,
        cubeID: req.params.id,
        missing,
        added: [],
        addedByBoard: {},
        changelog,
      });
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
