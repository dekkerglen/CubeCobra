import Joi from 'joi';

import { setupPicks } from '../../..//util/draftutil';
import { cardCmc, cardOracleId } from '../../../client/utils/cardutil';
import DraftType, { DraftStep } from '../../../datatypes/Draft';
import Draft from '../../../dynamo/models/draft';
import { csrfProtection } from '../../../routes/middleware';
import { NextFunction, Request, Response } from '../../../types/express';
import { deckbuild } from '../../../util/draftbots';
import { getCardDefaultRowColumn } from '../../../util/draftutil';

export interface Seat {
  picks: number[];
  trashed: number[];
  pack: number[];
}

export interface State {
  seats: Seat[];
  stepQueue: DraftStep[];
  pack: number;
  pick: number;
}

interface FinishDraftBody {
  state: State;
  mainboard: number[][][];
  sideboard: number[][][];
}

const FinishDraftBodySchema = Joi.object({
  state: Joi.object({
    seats: Joi.array()
      .items(
        Joi.object({
          picks: Joi.array().items(Joi.number()).required(),
          trashed: Joi.array().items(Joi.number()).required(),
          pack: Joi.array().items(Joi.number()).required(),
        }),
      )
      .required(),
    pack: Joi.number().required(),
    pick: Joi.number().required(),
  })
    .required()
    .unknown(true),
  mainboard: Joi.array()
    .items(Joi.array().items(Joi.array().items(Joi.number())))
    .required(),
  sideboard: Joi.array()
    .items(Joi.array().items(Joi.array().items(Joi.number())))
    .required(),
}).unknown(true); // allow additional fields

const validateBody = (req: Request, res: Response, next: NextFunction) => {
  const { error } = FinishDraftBodySchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
  }
  next();
};

const handler = async (req: Request, res: Response) => {
  try {
    const body = req.body as FinishDraftBody;

    const draft: DraftType = await Draft.getById(req.params.id);

    if (!draft) {
      return res.status(404).send({
        success: false,
        message: 'Draft not found',
      });
    }

    if (!req.user) {
      return res.status(401).send({
        success: false,
        message: 'You must be logged in to finish a draft',
      });
    }

    if (typeof draft.owner !== 'string' && draft.owner?.id !== req.user.id) {
      return res.status(401).send({
        success: false,
        message: 'You do not own this draft',
      });
    }

    for (let i = 0; i < body.state.seats.length; i += 1) {
      draft.seats[i].pickorder = body.state.seats[i].picks;
      draft.seats[i].trashorder = body.state.seats[i].trashed;
    }

    draft.seats[0].mainboard = body.mainboard;
    draft.seats[0].sideboard = body.sideboard;
    draft.complete = true;

    // we need to build the bot decks
    for (let i = 1; i < draft.seats.length; i += 1) {
      const picks = body.state.seats[i].picks;

      const { mainboard } = deckbuild(
        picks.map((index) => draft.cards[index].details),
        draft.basics.map((index) => draft.cards[index].details),
      );

      const pool = picks.slice();

      const newMainboard = [];

      for (const oracle of mainboard) {
        const poolIndex = pool.findIndex((cardindex) => cardOracleId(draft.cards[cardindex]) === oracle);
        if (poolIndex === -1) {
          // try basics
          const basicsIndex = draft.basics.findIndex((cardindex) => cardOracleId(draft.cards[cardindex]) === oracle);
          if (basicsIndex !== -1) {
            newMainboard.push(draft.basics[basicsIndex]);
          }
        } else {
          newMainboard.push(pool[poolIndex]);
          pool.splice(poolIndex, 1);
        }
      }

      // format mainboard
      const formattedMainboard = setupPicks(2, 8);
      const formattedSideboard = setupPicks(1, 8);

      for (const index of newMainboard) {
        const card = draft.cards[index];
        const { row, col } = getCardDefaultRowColumn(card);

        formattedMainboard[row][col].push(index);
      }

      for (const index of pool) {
        if (!draft.basics.includes(index)) {
          const card = draft.cards[index];
          const column = Math.max(0, Math.min(cardCmc(card), 7));

          formattedSideboard[0][column].push(index);
        }
      }

      draft.seats[i].mainboard = formattedMainboard;
      draft.seats[i].sideboard = formattedSideboard;
    }

    await Draft.put(draft);

    return res.status(200).send({
      success: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error finishing draft', err);
    return res.status(500).json({ error: 'Error finishing draft' });
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [csrfProtection, validateBody, handler],
  },
];
