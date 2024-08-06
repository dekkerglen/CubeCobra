// Load Environment Variables
require('dotenv').config();
const express = require('express');
const { fromEntries } = require('../serverjs/util');
const { csrfProtection, ensureAuth } = require('./middleware');
const {
  setup,
  getLobbyPlayers,
  getLobbySeatOrder,
  getDraftMetaData,
  getPlayerPack,
  getPlayerPicks,
  makePick,
  getPassAmount,
  getLobbyMetadata,
  addPlayerToLobby,
  updateLobbySeatOrder,
  getCurrentPackStepQueue,
  tryBotPicks,
} = require('../serverjs/multiplayerDrafting');

const Draft = require('../dynamo/models/draft');
const User = require('../dynamo/models/user');

const router = express.Router();

router.use(csrfProtection);

router.post('/getlobbyseats', ensureAuth, async (req, res) => {
  const { draft } = req.body;

  const players = await getLobbyPlayers(draft);
  const seats = await getLobbySeatOrder(draft);

  return res.status(200).send({
    success: 'true',
    players,
    seats,
  });
});

router.post('/getusernames', ensureAuth, async (req, res) => {
  const { ids } = req.body;

  const users = await User.batchGet(ids);

  return res.status(200).send({
    success: 'true',
    users: Object.fromEntries(users.map((user) => [user.id, user])),
  });
});

router.post('/startdraft', ensureAuth, async (req, res) => {
  const draftid = req.body.draft;

  const metadata = await getLobbyMetadata(draftid);

  if (metadata.host !== req.user.id) {
    return res.status(401).send({
      success: 'false',
    });
  }

  const draft = await Draft.getById(draftid);

  const seatOrder = await getLobbySeatOrder(draftid);

  const seatToPlayer = fromEntries(Object.entries(seatOrder).map(([player, seat]) => [parseInt(seat, 10), player]));

  for (let i = 0; i < draft.seats.length; i++) {
    if (seatToPlayer[i]) {
      draft.seats[i].owner = seatToPlayer[i];
      draft.seats[i].Bot = false;
    }
  }

  await Draft.put(draft);

  await setup(draft);

  return res.status(200).send({
    success: 'true',
  });
});

router.post('/draftpick', ensureAuth, async (req, res) => {
  const { draft, pick } = req.body;

  const seat = parseInt(req.body.seat, 10);
  const { currentPack, seats } = await getDraftMetaData(draft);

  const passDirection = currentPack % 2 === 0 ? 1 : -1;
  const passAmount = await getPassAmount(draft, seat);
  const nextSeat = (seat + seats + passDirection * passAmount) % seats;

  await makePick(draft, seat, pick, nextSeat);

  return res.status(200).send({
    success: 'true',
  });
});

router.post('/trybotpicks', ensureAuth, async (req, res) => {
  const { draft } = req.body;

  const { result, picks } = await tryBotPicks(draft);

  return res.status(200).send({
    success: 'true',
    result,
    picks,
  });
});

router.post('/getpack', ensureAuth, async (req, res) => {
  try {
    const { draft, seat } = req.body;

    const pack = await getPlayerPack(draft, seat);
    const steps = await getCurrentPackStepQueue(draft, seat);

    return res.status(200).send({
      success: 'true',
      data: {
        pack,
        steps,
      },
    });
  } catch (err) {
    req.logger.error(err.message, err.stack);
    return res.status(500).send({
      success: 'false',
      error: err,
    });
  }
});

router.post('/getpicks', ensureAuth, async (req, res) => {
  try {
    const { draft, seat } = req.body;

    const picks = await getPlayerPicks(draft, seat);

    return res.status(200).send({
      success: 'true',
      picks,
    });
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      error: err,
    });
  }
});

router.post('/isdraftinitialized', ensureAuth, async (req, res) => {
  const { draft } = req.body;
  const { initialized } = await getDraftMetaData(draft);

  return res.status(200).send({
    success: 'true',
    initialized,
    seats: await getLobbySeatOrder(draft),
  });
});

router.post('/editdeckbydraft', ensureAuth, async (req, res) => {
  const { draftId, mainboard, sideboard } = req.body;
  const seat = parseInt(req.body.seat, 10);

  for (let retry = 0; retry < 3; retry += 1) {
    try {
      if (retry > 0) {
        // add jitter
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
      }

      const deck = await Draft.getById(draftId);

      if (deck.seats[seat].owner.id !== req.user.id) {
        return res.status(401).send({
          success: 'false',
        });
      }

      deck.seats[seat].mainboard = mainboard;
      deck.seats[seat].sideboard = sideboard;
      await Draft.put(deck);

      return res.status(200).send({
        success: 'true',
        deck: deck.id,
      });
    } catch (err) {
      req.logger.error(err.message, err.stack);
    }
  }

  return res.status(500).send({
    success: 'false',
  });
});

router.post('/joinlobby', ensureAuth, async (req, res) => {
  const draftid = req.body.draft;

  const lobbyMetadata = await getLobbyMetadata(draftid);

  if (!req.user) {
    return res.status(200).send({
      success: 'false',
      message: 'Please login to join this draft.',
    });
  }

  const { id } = req.user;

  const playerList = await getLobbyPlayers(draftid);

  const { seats } = lobbyMetadata;

  if (playerList.slice(0, seats).includes(id)) {
    return res.status(200).send({
      success: 'true',
      playerList: await getLobbyPlayers(draftid),
    });
  }

  if (playerList.length >= seats) {
    return res.status(200).send({
      success: 'false',
      message: 'This draft is full.',
    });
  }

  await addPlayerToLobby(id, draftid);

  return res.status(200).send({
    success: 'true',
    playerList: await getLobbyPlayers(draftid),
  });
});

router.post('/updatelobbyseats', ensureAuth, async (req, res) => {
  const { draftid, order } = req.body;

  if (order.Bot) {
    delete order.Bot;
  }

  const metadata = await getLobbyMetadata(draftid);

  if (metadata.host !== req.user.id) {
    return res.status(401).send({
      success: 'false',
    });
  }

  await updateLobbySeatOrder(draftid, order);

  return res.status(200).send({
    success: 'true',
  });
});

router.post('/getseat', ensureAuth, async (req, res) => {
  const { draftid } = req.body;

  const seats = await getLobbySeatOrder(draftid);

  return res.status(200).send({
    success: 'true',
    seat: seats[req.user.id],
  });
});

module.exports = router;
