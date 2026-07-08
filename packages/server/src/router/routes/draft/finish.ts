import { State } from '@utils/datatypes/DraftState';
import User from '@utils/datatypes/User';
import { cubeDao, draftDao } from 'dynamo/daos';
import Joi from 'joi';
import { applyNaiveBotLayout, buildBotDecks } from 'serverutils/botDeckBuilder';
import { buildDeckbuildJob, writeDeckbuildJob } from 'serverutils/deckbuildJob';
import { publishBotDeckBuild } from 'serverutils/deckbuildQueue';
import { addNotification } from 'serverutils/util';

import { NextFunction, Request, Response } from '../../../types/express';

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
}).unknown(true); // allow additional fields (e.g. legacy `botDecks` from older clients)

export const validateBody = (req: Request, res: Response, next: NextFunction) => {
  const { error } = FinishDraftBodySchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0]?.message || 'Validation error' });
    return;
  }
  next();
};

export const handler = async (req: Request, res: Response) => {
  try {
    const body = req.body as FinishDraftBody;

    if (!req.params.id) {
      return res.status(400).send({
        success: false,
        message: 'Draft ID is required',
      });
    }

    const draft = await draftDao.getById(req.params.id);

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

    const draftOwnerId = typeof draft.owner !== 'string' ? draft.owner?.id : draft.owner;
    if (draftOwnerId !== req.user.id) {
      return res.status(401).send({
        success: false,
        message: 'You do not own this draft',
      });
    }

    // Persist each seat's pick/trash order — the async bot-deckbuild Lambda rebuilds bot
    // decks from seat.pickorder, so this must be saved before we enqueue the build.
    for (let i = 0; i < body.state.seats.length; i += 1) {
      const seat = draft.seats[i];
      const stateSeat = body.state.seats[i];
      if (seat && stateSeat) {
        seat.pickorder = stateSeat.picks;
        seat.trashorder = stateSeat.trashed;
      }
    }

    const firstSeat = draft.seats[0];
    if (firstSeat) {
      firstSeat.mainboard = body.mainboard;
      firstSeat.sideboard = body.sideboard;
    }
    draft.complete = true;

    const cube = await cubeDao.getById(draft.cube);
    const buildOpts = { maxSpells: cube?.deckbuildSpells ?? 23, maxLands: cube?.deckbuildLands ?? 17 };
    const queueEnabled = !!process.env.BOT_DECKBUILD_TOPIC_ARN;

    // Build the async job from the intact draft BEFORE naive layout / update mutate it.
    const job = queueEnabled ? buildDeckbuildJob(draft, buildOpts) : null;

    // Give bot seats a cheap naive layout now so the draft is immediately viewable.
    applyNaiveBotLayout(draft);

    if (queueEnabled) {
      // Deployed: hand the ML build off to the async bot-deckbuild pipeline (off the request
      // path). The Lambda replaces the naive decks and clears the flag.
      draft.botDecksPending = true;
    } else {
      // Local dev / self-hosted without the pipeline: build inline so there's no queue to
      // wait on and no banner that never resolves. ML failures keep the naive layout.
      try {
        await buildBotDecks(draft, buildOpts);
      } catch (err) {
        req.logger.error('Inline bot deckbuild failed; keeping naive layout', err);
      }
      draft.botDecksPending = false;
    }

    //Draft.update changes the draft object, replacing objects with ids, so store these to use after
    const cubeOwner = draft.cubeOwner;
    const cubeId = draft.cube;
    const draftOwner = draft.owner;

    await draftDao.update(draft);

    if (queueEnabled && job) {
      // Write the claim-check job to S3, then enqueue just the draft id. If that fails, the
      // draft would otherwise be stuck pending forever — mark it failed so the client shows a
      // terminal state instead of polling indefinitely.
      try {
        await writeDeckbuildJob(job);
        await publishBotDeckBuild(draft.id);
      } catch (err) {
        req.logger.error('Failed to enqueue bot deckbuild; marking failed', err);
        await draftDao.markBotDecksFailed(draft.id);
      }
    }

    //Annoying guard since the values will be objects
    if (typeof cubeOwner !== 'string' && typeof draftOwner !== 'string') {
      await sendDraftNotification(draft.id, cubeOwner, draftOwner!, cubeId);
    }

    return res.status(200).send({
      success: true,
    });
  } catch (err) {
    req.logger.error('Error finishing draft', err);
    return res.status(500).json({ error: 'Error finishing draft' });
  }
};

const sendDraftNotification = async (draftId: string, cubeOwner: User, draftOwner: User, cubeId: string) => {
  const cubeOwnerId = cubeOwner.id;
  const draftOwnerId = draftOwner.id;
  if (cubeOwnerId === draftOwnerId) {
    return;
  }

  const cube = await cubeDao.getById(cubeId);
  if (!cube) {
    return;
  }

  if (cube.disableAlerts) {
    return;
  }

  //Type guard should be unnecessary in real life
  if (typeof draftOwner !== 'string') {
    //Takes User objects
    await addNotification(
      cubeOwner,
      draftOwner,
      `/cube/deck/${draftId}`,
      `${draftOwner?.username} drafted your cube: ${cube.name}`,
    );
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [validateBody, handler],
  },
];
