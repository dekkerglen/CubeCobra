/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
// Load Environment Variables
require('dotenv').config();
const express = require('express');
const { lpush } = require('../serverjs/redis');
const Draft = require('../models/draft');
const { csrfProtection, ensureAuth } = require('./middleware');
const {
  setup,
  getDraftMetaData,
  openPack,
  getPlayerPack,
  getPlayerPicks,
  getDraftBotsSeats,
  makePick,
  isPackDone,
  cleanUp,
  printDraftState,
} = require('../serverjs/multiplayerDrafting');

const router = express.Router();

router.use(csrfProtection);

router.post('/publishmessage', ensureAuth, async (req, res) => {
  await lpush(req.body.room, req.body.message);

  return res.status(200).send({
    success: 'true',
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
      await cleanUp(draft);
    }
  }

  printDraftState(req.body.draft);

  return res.status(200).send({
    success: 'true',
  });
});

router.post('/getpack', ensureAuth, async (req, res) => {
  const { draft, seat } = req.body;

  return res.status(200).send({
    success: 'true',
    pack: await getPlayerPack(draft, seat),
  });
});

router.post('/getpicks', ensureAuth, async (req, res) => {
  const { draft, seat } = req.body;

  return res.status(200).send({
    success: 'true',
    picks: await getPlayerPicks(draft, seat),
  });
});

router.post('/isdraftinitialized', ensureAuth, async (req, res) => {
  const { draft } = req.body;
  const { initialized } = await getDraftMetaData(draft);

  return res.status(200).send({
    success: 'true',
    initialized,
  });
});

module.exports = router;
