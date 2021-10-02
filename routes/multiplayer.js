/* eslint-disable no-await-in-loop */
// Load Environment Variables
require('dotenv').config();
const express = require('express');
const { fromEntries } = require('../serverjs/util');
const { lpush } = require('../serverjs/redis');
const { getUserFromId } = require('../serverjs/cache.js');
const { csrfProtection, ensureAuth } = require('./middleware');
const {
  setup,
  getLobbyPlayers,
  getLobbySeatOrder,
  getDraftMetaData,
  openPack,
  getPlayerPack,
  getPlayerPicks,
  getDraftBotsSeats,
  makePick,
  isPackDone,
  finishDraft,
  getLobbyMetadata,
  addPlayerToLobby,
  updateLobbySeatOrder,
  packNeedsBotPicks,
} = require('../serverjs/multiplayerDrafting');

const Draft = require('../models/draft');
const Deck = require('../models/deck');

const router = express.Router();

router.use(csrfProtection);

router.post('/publishmessage', ensureAuth, async (req, res) => {
  await lpush(req.body.room, req.body.message);

  return res.status(200).send({
    success: 'true',
  });
});

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

router.post('/startdraft', ensureAuth, async (req, res) => {
  const draftid = req.body.draft;

  const metadata = await getLobbyMetadata(draftid);

  if (metadata.host !== req.user.id) {
    return res.status(401).send({
      success: 'false',
    });
  }

  const draft = await Draft.findById(draftid);

  const seatOrder = await getLobbySeatOrder(draftid);
  const seatToPlayer = fromEntries(Object.entries(seatOrder).map(([player, seat]) => [parseInt(seat, 10), player]));

  for (let i = 0; i < draft.seats.length; i++) {
    if (seatToPlayer[i]) {
      const user = await getUserFromId(seatToPlayer[i]);

      draft.seats[i].userid = seatToPlayer[i];
      draft.seats[i].bot = false;
      draft.seats[i].name = user.username;
    }
  }

  await draft.save();

  await setup(draft);

  return res.status(200).send({
    success: 'true',
  });
});

router.post('/draftpick', ensureAuth, async (req, res) => {
  const { draft, pick } = req.body;
  const seat = parseInt(req.body.seat, 10);
  const { currentPack, seats, totalPacks } = await getDraftMetaData(draft);

  const passDirection = currentPack % 2 === 0 ? 1 : -1;
  const nextSeat = (seat + seats + passDirection) % seats;

  await makePick(draft, seat, pick, nextSeat);

  while (await packNeedsBotPicks(draft)) {
    // make bot picks
    const botSeats = await getDraftBotsSeats(draft);
    for (const index of botSeats) {
      // TODO: plug in draft bot logic here
      const next = (index + seats + passDirection) % seats;
      await makePick(draft, index, 0, next);
    }
  }

  if (await isPackDone(draft)) {
    if (currentPack < totalPacks) {
      await openPack(draft);
    } else {
      // draft is done
      await finishDraft(draft, await Draft.findById(draft));
    }
  }

  return res.status(200).send({
    success: 'true',
  });
});

router.post('/getpack', ensureAuth, async (req, res) => {
  try {
    const { draft, seat } = req.body;

    const pack = await getPlayerPack(draft, seat);

    return res.status(200).send({
      success: 'true',
      pack,
    });
  } catch (err) {
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
  const { draftId, drafted, sideboard } = req.body;
  const seat = parseInt(req.body.seat, 10);

  for (let retry = 0; retry < 3; retry += 1) {
    try {
      if (retry > 0) {
        // add jitter
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
      }

      const deck = await Deck.findOne({ draft: draftId });

      if (!deck.seats[seat].userid.equals(req.user.id)) {
        return res.status(401).send({
          success: 'false',
        });
      }

      deck.seats[seat].deck = drafted;
      deck.seats[seat].sideboard = sideboard;
      await deck.save();
      return res.status(200).send({
        success: 'true',
        deck: deck._id,
      });
    } catch (err) {
      req.logger.error(err);
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
