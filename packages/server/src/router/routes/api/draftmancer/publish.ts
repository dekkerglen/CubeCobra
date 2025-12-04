import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import type CubeType from '@utils/datatypes/Cube';
import DraftType, { DraftmancerLog } from '@utils/datatypes/Draft';
import { PublishDraftBody } from '@utils/datatypes/Draftmancer';
import type DraftSeatType from '@utils/datatypes/DraftSeat';
import { setupPicks } from '@utils/draftutil';
import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import Notification from 'dynamo/models/notification';
import Joi from 'joi';
import { bodyValidation } from 'src/router/middleware';
import { cardFromId } from 'serverutils/carddb';
import { buildBotDeck, formatMainboard, formatSideboard, getPicksFromPlayer } from 'serverutils/draftmancerUtil';

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
    const cube = await Cube.getById(publishDraftBody.cubeID);
    if (!cube) {
      return res.status(404).json({ error: 'Cube not found' });
    }

    // start with basics, we add the rest of the cards after
    const cards: CardDetails[] = [...cube.basics.map((card) => cardFromId(card))];
    const basics: number[] = [...Array(cube.basics.length).keys()];

    const seats: DraftSeatType[] = [];
    const draftmancerLog: DraftmancerLog = {
      sessionID: publishDraftBody.sessionID,
      players: [],
    };

    let drafterName: string = '';
    for (const player of publishDraftBody.players) {
      let mainboard: number[][][] = setupPicks(2, 8);
      let sideboard: number[][][] = setupPicks(1, 8);

      const { draftmancerPicks, pickorder, trashorder } = getPicksFromPlayer(player.picks, cards);

      // we need to build the bot decks
      if (player.isBot) {
        const result = buildBotDeck(pickorder, basics, cards);
        mainboard = result.mainboard;
        sideboard = result.sideboard;
      } else {
        mainboard = formatMainboard(player.decklist, cards);
        sideboard = formatSideboard(player.decklist, cards);

        if (!drafterName) {
          drafterName = player.userName || 'Unknown Drafter';
        }
      }

      const seat: DraftSeatType = {
        description: player.isBot
          ? `This deck was drafted by a bot on Draftmancer`
          : `This deck was drafted on Draftmancer by ${player.userName || 'Unknown Drafter'}`,
        mainboard,
        sideboard,
        pickorder,
        trashorder,
        owner: undefined,
        bot: player.isBot,
        name: '', // this will get set by the draft dao
      };

      seats.push(seat);
      draftmancerLog.players.push(draftmancerPicks);
    }

    const draft: Omit<DraftType, 'id'> = {
      name: 'Draftmancer Draft',
      seats,
      cards: cards.map((c) => detailsToCard(c)),
      cube: cube.id,
      InitialState: undefined, // we cannot calculate the initial state
      basics,
      seed: undefined, // we don't have a seed
      type: 'd', // we only support regular drafts for now
      owner: undefined, // anonymous, since we don't have a user
      cubeOwner: cube.owner,
      date: new Date().valueOf(),
      complete: true,
      DraftmancerLog: draftmancerLog,
    };

    const draftId = await Draft.put(draft);

    await sendDraftNotification(draftId, drafterName, cube);

    return res.status(200).send({
      draftId,
    });
  } catch (error) {
    req.logger?.error('Error publishing draft', error);
    return res.status(500).json({ error: 'Error publishing draft' });
  }
};

const sendDraftNotification = async (draftId: string, drafterName: string, cube: CubeType) => {
  if (cube.disableAlerts || !drafterName) {
    return;
  }

  const cubeOwner = cube.owner;

  //Cannot use helper as the from is not a real user
  await Notification.put({
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
