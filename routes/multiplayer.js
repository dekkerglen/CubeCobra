/* eslint-disable no-await-in-loop */
// Load Environment Variables
require('dotenv').config();
const express = require('express');
const { lpush } = require('../serverjs/redis');
const { csrfProtection, ensureAuth } = require('./middleware');
const {
  init,
  setup,
  getSeatsForDraft,
  getDraftMetaData,
  openPack,
  getPlayerPack,
  getPlayerPicks,
  getDraftBotsSeats,
  makePick,
  isPackDone,
  finishDraft,
  getPlayerList,
  addPlayerToDraft,
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

router.post('/initdraft', ensureAuth, async (req, res) => {
  const draft = await Draft.findById(req.body.draft);

  if (draft.seats[0].userid !== req.user.id) {
    return res.status(401).send({
      success: 'false',
    });
  }

  await init(draft);

  return res.status(200).send({
    success: 'true',
  });
});

router.post('/getdraftseats', ensureAuth, async (req, res) => {
  const draft = await Draft.findById(req.body.draft);

  return res.status(200).send({
    success: 'true',
    seats: await getSeatsForDraft(draft),
  });
});

router.post('/startdraft', ensureAuth, async (req, res) => {
  const draft = await Draft.findById(req.body.draft);

  if (draft.seats[0].userid !== req.user.id) {
    return res.status(401).send({
      success: 'false',
    });
  }

  await setup(draft);

  return res.status(200).send({
    success: 'true',
  });
});

router.post('/draftpick', ensureAuth, async (req, res) => {
  const { draft, seat, pick } = req.body;
  const { currentPack, seats, totalPacks } = await getDraftMetaData(draft);

  const passDirection = currentPack % 2 === 0 ? 1 : -1;
  const nextSeat = (seat + seats + passDirection) % seats;

  await makePick(draft, seat, pick, nextSeat);

  if (seat === 0) {
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
  });
});

router.post('/editdeckbydraft', ensureAuth, async (req, res) => {
  const { draftId, seat, drafted, sideboard } = req.body;
  const deck = await Deck.findOne({ draft: draftId });

  if (deck.seats[seat].userid !== req.user.id) {
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
});

router.post('/joinlobby', ensureAuth, async (req, res) => {
  const draftid = req.body.draft;
  const draft = await Draft.findById(draftid).lean();

  if (!req.user) {
    return res.status(200).send({
      success: 'false',
      message: 'Please login to join this draft.',
    });
  }

  const { id } = req.user;

  const playerList = await getPlayerList(draftid);

  const seats = draft.seats.length;

  if (playerList.slice(0, seats).includes(id)) {
    return res.status(200).send({
      success: 'true',
    });
  }

  if (playerList.length >= seats) {
    return res.status(200).send({
      success: 'false',
      message: 'This draft is full.',
    });
  }

  await addPlayerToDraft(draftid, id);
  return res.status(200).send({
    success: 'true',
    playerList: await getPlayerList(draftid),
  });
});

module.exports = router;
