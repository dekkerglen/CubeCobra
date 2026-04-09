import * as cardutil from '@utils/cardutil';
import type DraftType from '@utils/datatypes/Draft';
import { createDraft, getDraftFormat } from '@utils/drafting/createdraft';
import { cubeDao, draftDao } from 'dynamo/daos';
import Joi from 'joi';
import { cardFromId } from 'serverutils/carddb';
import { addBasics, getBasicsFromCube } from 'serverutils/cube';
import { isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';

import { NextFunction, Request, Response } from '../../../types/express';

interface StartDraftBody {
  id?: string; // id of the format
  seats?: string;
  packs?: string;
  cards?: string;
}

const StartDraftBodySchema = Joi.object({
  packs: Joi.number().integer().min(1).max(16),
  cards: Joi.number().integer().min(1).max(25),
  seats: Joi.number().integer().min(2).max(17),
  id: Joi.string(),
}).unknown(true); // allow additional fields

const validateBody = (req: Request, res: Response, next: NextFunction) => {
  const { error } = StartDraftBodySchema.validate(req.body);
  if (error) {
    req.flash('danger', 'Invalid request: ' + error.message);
    return redirect(req, res, '/404');
  }
  next();
};

const handler = async (req: Request, res: Response) => {
  try {
    const body = req.body as StartDraftBody;
    const cubeId = req.params.id;

    if (!cubeId) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!req.user) {
      req.flash('danger', 'You must be logged in to start a draft');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeId)}`);
    }

    const cube = await cubeDao.getById(cubeId);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cubeCards = await cubeDao.getCards(cubeId);
    const { mainboard } = cubeCards;

    if (mainboard.length === 0) {
      // This is a 4XX error, not a 5XX error
      req.flash('danger', 'This cube has no cards!');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeId)}`);
    }

    // setup draft
    const format = getDraftFormat(
      {
        id: parseInt(body.id || '-1'),
        packs: parseInt(body.packs || '3'),
        players: parseInt(body.seats || '8'),
        cards: parseInt(body.cards || '15'),
      },
      cube,
    );

    // Build board cards map for multi-board draft support
    const boardCards: Record<string, any[]> = {};
    for (const [boardKey, cards] of Object.entries(cubeCards)) {
      if (boardKey !== 'id' && Array.isArray(cards)) {
        boardCards[boardKey] = cards;
      }
    }

    let populated: DraftType;
    try {
      populated = createDraft(cube, format, boardCards, parseInt(req.body.seats), req.user);
    } catch (err) {
      // This is a 4XX error, not a 5XX error
      req.flash('danger', (err as Error).message);
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeId)}`);
    }

    // Ensure all cards have their index set
    const cardsWithIndex = populated.cards.map((card, index) => ({
      ...card,
      index: card.index ?? index,
      type_line: card.type_line || card.details?.type || '',
    }));

    // Expand voucher sub-cards: for each voucher, append its sub-cards to the cards array
    // and store the indices on the voucher so they can be looked up on page reload
    const expandedCards: any[] = [...cardsWithIndex];
    for (let i = 0; i < cardsWithIndex.length; i++) {
      const card = cardsWithIndex[i];
      if (!card) continue;
      if (cardutil.isVoucher(card) && card.voucher_cards && card.voucher_cards.length > 0) {
        const subCardIndices: number[] = [];
        for (const vc of card.voucher_cards) {
          const newIndex = expandedCards.length;
          const subCard = {
            cardID: vc.cardID,
            imgUrl: vc.imgUrl,
            imgBackUrl: vc.imgBackUrl,
            colors: vc.colors,
            colorCategory: vc.colorCategory,
            finish: vc.finish,
            status: vc.status,
            cmc: vc.cmc,
            type_line: vc.type_line || vc.details?.type || '',
            rarity: vc.rarity,
            notes: vc.notes,
            tags: vc.tags,
            custom_name: vc.custom_name,
            details: vc.details || cardFromId(vc.cardID),
            index: newIndex,
          };
          expandedCards.push(subCard);
          subCardIndices.push(newIndex);
        }
        // Store the sub-card indices on the voucher card
        (expandedCards[i] as any).voucher_card_indices = subCardIndices;
      }
    }

    const draft = {
      complete: false,
      cube: cube.id,
      cubeOwner: cube.owner.id,
      date: new Date().valueOf(),
      InitialState: populated.InitialState,
      owner: req.user?.id,
      seats: populated.seats,
      type: 'd' as const,
      cards: expandedCards,
      basics: [] as number[], // Will be populated by addBasics
      basicsBoard: populated.basicsBoard, // Store which board basics come from
      name: '',
    };

    // Get basics from the specified board or fall back to legacy cube.basics
    const basicsToAdd = getBasicsFromCube(cubeCards, populated.basicsBoard, cube.basics);

    // addBasics modifies the draft object in place, adding basic cards to cards array
    // and setting basics to be an array of card indices
    addBasics(draft, basicsToAdd);

    const draftId = await draftDao.createDraft(draft);

    return redirect(req, res, `/draft/${draftId}`);
  } catch (err) {
    const cubeId = req.params.id || '';
    return handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(cubeId)}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [validateBody, handler],
  },
];
