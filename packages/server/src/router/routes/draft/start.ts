import type DraftType from '@utils/datatypes/Draft';
import { createDraft, getDraftFormat } from '@utils/drafting/createdraft';
import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import Joi from 'joi';
import { addBasics } from 'serverutils/cube';
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

    const cube = await Cube.getById(cubeId);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cubeCards = await Cube.getCards(cubeId);
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

    let populated: DraftType;
    try {
      populated = createDraft(cube, format, mainboard, parseInt(req.body.seats), req.user);
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

    const draft: Omit<DraftType, 'id'> = {
      complete: false,
      cube: cube.id,
      cubeOwner: cube.owner.id,
      date: new Date().valueOf(),
      InitialState: populated.InitialState,
      owner: req.user?.id,
      seats: populated.seats,
      type: 'd',
      cards: cardsWithIndex,
      basics: [],
      name: '',
    };

    // addBasics expects cards with required index and type_line
    const draftDocument = draft as unknown as {
      cards: { cardID: string; index: number; isUnlimited?: boolean; type_line: string }[];
      basics: number[];
    };
    addBasics(draftDocument, cube.basics);

    const draftId = await Draft.put(draftDocument as any);

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
