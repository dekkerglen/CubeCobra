import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import type CubeType from '@utils/datatypes/Cube';
import DraftType, { DraftmancerLog } from '@utils/datatypes/Draft';
import { PublishDraftBody } from '@utils/datatypes/Draftmancer';
import type DraftSeatType from '@utils/datatypes/DraftSeat';
import { setupPicks } from '@utils/draftutil';
import { cubeDao, draftDao, notificationDao } from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation } from 'router/middleware';
import { applyNaiveBotLayout, buildBotDecks } from 'serverutils/botDeckBuilder';
import { cardFromId } from 'serverutils/carddb';
import { getBasicsFromCube } from 'serverutils/cube';
import { buildDeckbuildJob, writeDeckbuildJob } from 'serverutils/deckbuildJob';
import { publishBotDeckBuild } from 'serverutils/deckbuildQueue';
import { formatMainboard, formatSideboard, getPicksFromPlayer } from 'serverutils/draftmancerUtil';

import { Request, Response } from '../../../../types/express';

//Don't expect DraftMancer to handle custom cards
const OracleIDSchema = Joi.string().uuid();

export const PublishDraftBodySchema = Joi.object({
  cubeID: Joi.string().required(),
  sessionID: Joi.string().required(),
  timestamp: Joi.number().required(),
  players: Joi.array()
    .items(
      Joi.object({
        userName: Joi.string().optional(),
        isBot: Joi.boolean().required(),
        picks: Joi.array()
          .items(
            Joi.object({
              booster: Joi.array().items(OracleIDSchema).required(),
              picks: Joi.array().items(Joi.number()).required(),
              burn: Joi.array().items(Joi.number()).required(),
            }),
          )
          .required(),
        decklist: Joi.object({
          main: Joi.array().items(OracleIDSchema).required(),
          side: Joi.array().items(OracleIDSchema).required(),
          lands: Joi.object({
            W: Joi.number().required(),
            U: Joi.number().required(),
            B: Joi.number().required(),
            R: Joi.number().required(),
            G: Joi.number().required(),
          }).required(),
        }).required(),
      }),
    )
    .required(),
  apiKey: Joi.string().required(),
});

export const handler = async (req: Request, res: Response) => {
  const publishDraftBody = req.body as PublishDraftBody;

  if (publishDraftBody.apiKey !== process.env.DRAFTMANCER_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const cube = await cubeDao.getById(publishDraftBody.cubeID);
    if (!cube) {
      return res.status(404).json({ error: 'Cube not found' });
    }

    // Fetch cube cards to resolve basics from the designated board
    const cubeCards = await cubeDao.getCards(publishDraftBody.cubeID);
    const basicsBoard = cube.basicsBoard || 'Basics';
    const basicsCardIds = getBasicsFromCube(cubeCards, basicsBoard, cube.basics);

    // Pre-populate cards with basics so buildBotDeck can reference them by index
    const cards: CardDetails[] = [...basicsCardIds.map((cardID) => cardFromId(cardID))];
    const basics: number[] = [...Array(basicsCardIds.length).keys()];

    const seats: DraftSeatType[] = [];
    const draftmancerLog: DraftmancerLog = {
      sessionID: publishDraftBody.sessionID,
      players: [],
    };

    let drafterName: string = '';

    // Parse picks for all players. Human seats get their decklist formatted now; bot seats
    // start empty and are filled with a cheap naive layout below — the real ML build runs
    // asynchronously in the bot-deckbuild Lambda after we enqueue this draft.
    for (const player of publishDraftBody.players) {
      const { draftmancerPicks, pickorder, trashorder } = getPicksFromPlayer(player.picks, cards);

      const seat: DraftSeatType = {
        description: player.isBot
          ? `This deck was drafted by a bot on Draftmancer`
          : `This deck was drafted on Draftmancer by ${player.userName || 'Unknown Drafter'}`,
        mainboard: player.isBot ? setupPicks(2, 8) : formatMainboard(player.decklist, cards),
        sideboard: player.isBot ? setupPicks(1, 8) : formatSideboard(player.decklist, cards),
        pickorder,
        trashorder,
        owner: undefined,
        bot: player.isBot,
        name: '', // this will get set by the draft dao
        playerName: player.userName || undefined,
      };

      seats.push(seat);
      draftmancerLog.players.push(draftmancerPicks);

      if (!player.isBot && !drafterName) {
        drafterName = player.userName || 'Unknown Drafter';
      }
    }

    const draft: Omit<DraftType, 'id'> = {
      name: 'Draftmancer Draft',
      seats,
      cards: cards.map((c) => detailsToCard(c)),
      cube: cube.id,
      InitialState: undefined, // we cannot calculate the initial state
      basics,
      basicsBoard,
      seed: undefined, // we don't have a seed
      type: 'd', // we only support regular drafts for now
      owner: undefined, // anonymous, since we don't have a user
      cubeOwner: cube.owner,
      date: new Date().valueOf(),
      complete: true,
      DraftmancerLog: draftmancerLog,
    };

    const buildOpts = { maxSpells: cube.deckbuildSpells ?? 23, maxLands: cube.deckbuildLands ?? 17 };
    const queueEnabled = !!process.env.BOT_DECKBUILD_TOPIC_ARN;

    // Give bot seats a viewable naive layout immediately. Mutates draft.seats in place
    // (id is unused by the layout).
    applyNaiveBotLayout(draft as unknown as DraftType);

    if (queueEnabled) {
      // Deployed: hand the ML build off to the async bot-deckbuild pipeline.
      draft.botDecksPending = true;
    } else {
      // Local dev / no pipeline: build inline. ML failures keep the naive layout.
      try {
        await buildBotDecks(draft as unknown as DraftType, buildOpts);
      } catch (err) {
        req.logger?.error('Inline bot deckbuild failed; keeping naive layout', err);
      }
      draft.botDecksPending = false;
    }

    const draftId = await draftDao.createDraft(draft);

    if (queueEnabled) {
      // Write the claim-check job (needs the created draft id), then enqueue just the id. On
      // failure, mark the draft failed so the client doesn't poll a stuck pending state.
      try {
        await writeDeckbuildJob(buildDeckbuildJob({ ...(draft as unknown as DraftType), id: draftId }, buildOpts));
        await publishBotDeckBuild(draftId);
      } catch (err) {
        req.logger?.error('Failed to enqueue bot deckbuild; marking failed', err);
        await draftDao.markBotDecksFailed(draftId);
      }
    }

    await sendDraftNotification(draftId, drafterName, cube);

    // The request may have already timed out (see the res.setTimeout handler in index.ts),
    // in which case a response was already sent — don't try to send again.
    if (res.headersSent) {
      return;
    }

    return res.status(200).send({
      draftId,
    });
  } catch (error) {
    req.logger?.error('Error publishing draft', error);
    if (res.headersSent) {
      return;
    }
    return res.status(500).json({ error: 'Error publishing draft' });
  }
};

const sendDraftNotification = async (draftId: string, drafterName: string, cube: CubeType) => {
  if (cube.disableAlerts || !drafterName) {
    return;
  }

  const cubeOwner = cube.owner;

  //Cannot use helper as the from is not a real user
  await notificationDao.put({
    date: new Date().valueOf(),
    to: cubeOwner.id,
    fromUsername: drafterName,
    url: `/cube/deck/${draftId}`,
    body: `${drafterName} drafted your cube: ${cube.name}`,
  });
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [bodyValidation(PublishDraftBodySchema), handler],
  },
];
