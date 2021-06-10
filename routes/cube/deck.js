const express = require('express');
const { body } = require('express-validator');
const { Canvas, Image } = require('canvas');

Canvas.Image = Image;

const miscutil = require('../../dist/utils/Util.js');
const carddb = require('../../serverjs/cards.js');
const { buildDeck } = require('../../dist/drafting/deckutil.js');
const { render } = require('../../serverjs/render');
const util = require('../../serverjs/util.js');
const generateMeta = require('../../serverjs/meta.js');
const cardutil = require('../../dist/utils/Card.js');
const frontutil = require('../../dist/utils/Util.js');
const { ensureAuth } = require('../middleware');

const { buildIdQuery, abbreviate, addDeckCardAnalytics, removeDeckCardAnalytics } = require('../../serverjs/cubefn.js');

const { exportToMtgo, createPool, rotateArrayLeft } = require('./helper.js');

// Bring in models
const Cube = require('../../models/cube');
const Deck = require('../../models/deck');
const User = require('../../models/user');
const CubeAnalytic = require('../../models/cubeAnalytic');
const Draft = require('../../models/draft');
const GridDraft = require('../../models/gridDraft');

const router = express.Router();

router.get('/download/xmage/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();

    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`NAME:${seat.name}\r\n`);
    const main = {};
    for (const row of seat.deck) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.cards[cardIndex].cardID);
          const name = `[${details.set.toUpperCase()}:${details.collector_number}] ${details.name}`;
          if (main[name]) {
            main[name] += 1;
          } else {
            main[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    const side = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.cards[cardIndex].cardID);
          const name = `[${details.set.toUpperCase()}:${details.collector_number}] ${details.name}`;
          if (side[name]) {
            side[name] += 1;
          } else {
            side[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`SB: ${value} ${key}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/forge/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`Name=${seat.name}\r\n`);
    res.write('[Main]\r\n');
    const main = {};
    for (const row of seat.deck) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.cards[cardIndex].cardID);
          const name = `${details.name}|${details.set.toUpperCase()}`;
          if (main[name]) {
            main[name] += 1;
          } else {
            main[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    res.write('[Side]\r\n');
    const side = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.cards[cardIndex].cardID);
          const name = `${details.name}|${details.set.toUpperCase()}`;
          if (side[name]) {
            side[name] += 1;
          } else {
            side[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value} ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/txt/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const row of seat.deck) {
      for (const col of row) {
        for (const cardIndex of col) {
          const { name } = carddb.cardFromId(deck.cards[cardIndex].cardID);
          res.write(`${name}\r\n`);
        }
      }
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/mtgo/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];
    return exportToMtgo(res, seat.name, seat.deck.flat(), seat.sideboard.flat(), deck.cards);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/arena/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('Deck\r\n');
    const main = {};
    for (const row of seat.deck) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.cards[cardIndex].cardID);
          const name = `${details.name} (${details.set.toUpperCase()}) ${details.collector_number}`;
          if (main[name]) {
            main[name] += 1;
          } else {
            main[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    res.write('\r\nSideboard\r\n');
    const side = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.cards[cardIndex].cardID);
          const name = `${details.name} (${details.set.toUpperCase()}) ${details.collector_number}`;
          if (side[name]) {
            side[name] += 1;
          } else {
            side[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value} ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/cockatrice/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    const main = {};
    for (const row of seat.deck) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.cards[cardIndex].cardID);
          const name = `${details.name}`;
          if (main[name]) {
            main[name] += 1;
          } else {
            main[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value}x ${key}\r\n`);
    }

    res.write('Sideboard\r\n');
    const side = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.cards[cardIndex].cardID);
          const name = `${details.name}`;
          if (side[name]) {
            side[name] += 1;
          } else {
            side[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value}x ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.delete('/deletedeck/:id', ensureAuth, async (req, res) => {
  try {
    const query = {
      _id: req.params.id,
    };

    const deck = await Deck.findById(req.params.id);
    const deckOwner = (await User.findById(deck.seats[0].userid)) || {};

    if (!deckOwner._id.equals(req.user._id) && !deck.cubeOwner === req.user._id) {
      req.flash('danger', 'Unauthorized');
      return res.redirect('/404');
    }

    await Deck.deleteOne(query);

    req.flash('success', 'Deck Deleted');
    return res.send('Success');
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting deck.',
    });
  }
});

router.get('/deckbuilder/:id', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }

    const deckOwner = await User.findById(deck.seats[0].userid).lean();
    if (!req.user || !deckOwner._id.equals(req.user._id)) {
      req.flash('danger', 'Only logged in deck owners can build decks.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const cube = await Cube.findOne(buildIdQuery(deck.cube), `${Cube.LAYOUT_FIELDS} basics useCubeElo`).lean();
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = util.fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }

    // add details to cards
    for (const card of deck.cards) {
      card.details = carddb.cardFromId(card.cardID);
      if (eloOverrideDict[card.details.name_lower]) {
        card.details.elo = eloOverrideDict[card.details.name_lower];
      }
    }

    return render(
      req,
      res,
      'CubeDeckbuilderPage',
      {
        cube,
        initialDeck: deck,
      },
      {
        title: `${abbreviate(cube.name)} - Deckbuilder`,
        metadata: generateMeta(
          `Cube Cobra Draft: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/draft/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/decks/:cubeid/:page', async (req, res) => {
  try {
    const { cubeid } = req.params;
    const pagesize = 30;

    const page = parseInt(req.params.page, 10);

    const cube = await Cube.findOne(buildIdQuery(cubeid), Cube.LAYOUT_FIELDS).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const decksq = Deck.find(
      {
        cube: cube._id,
      },
      '_id seats date cube',
    )
      .sort({
        date: -1,
      })
      .skip(pagesize * page)
      .limit(pagesize)
      .lean()
      .exec();
    const numDecksq = Deck.countDocuments({
      cube: cube._id,
    }).exec();

    const [numDecks, decks] = await Promise.all([numDecksq, decksq]);

    return render(
      req,
      res,
      'CubeDecksPage',
      {
        cube,
        decks,
        pages: Math.ceil(numDecks / pagesize),
        activePage: page,
      },
      {
        title: `${abbreviate(cube.name)} - Draft Decks`,
        metadata: generateMeta(
          `Cube Cobra Decks: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/user/decks/${encodeURIComponent(req.params.cubeid)}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.cubeid)}`);
  }
});

router.get('/decks/:id', async (req, res) => {
  res.redirect(`/cube/deck/decks/${encodeURIComponent(req.params.id)}/0`);
});

router.get('/rebuild/:id/:index', ensureAuth, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    const base = await Deck.findById(req.params.id).lean();
    const draft = await Draft.findById(base.draft).lean();

    if (!base) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }
    const cube = await Cube.findById(base.cube);
    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = util.fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }

    const cardsArray = [];
    for (const card of base.cards) {
      const newCard = { ...card, details: carddb.cardFromId(card.cardID) };
      if (eloOverrideDict[newCard.details.name_lower]) {
        newCard.details.elo = eloOverrideDict[newCard.details.name_lower];
      }
      cardsArray.push(newCard);
    }

    const deck = new Deck();
    deck.cube = base.cube;
    deck.cubeOwner = base.owner;
    deck.date = Date.now();
    deck.cubename = cube.name;
    deck.draft = base.draft;
    deck.seats = [];
    deck.owner = req.user._id;
    deck.cards = base.cards;
    deck.basics = base.basics;

    const { colors: userColors } = await buildDeck(cardsArray, draft.seats[index].pickorder, deck.basics);

    deck.seats.push({
      userid: req.user._id,
      username: `${req.user.username}: ${userColors}`,
      name: `${req.user.username}'s rebuild from ${cube.name} on ${deck.date.toLocaleString('en-US')}`,
      description: 'This deck was rebuilt from another draft deck.',
      deck: base.seats[index].deck,
      sideboard: base.seats[index].sideboard,
    });
    let botNumber = 1;
    for (let i = 0; i < base.seats.length; i++) {
      if (i !== index) {
        const {
          deck: builtDeck,
          sideboard,
          colors,
          // eslint-disable-next-line no-await-in-loop
        } = await buildDeck(cardsArray, draft.seats[i].pickorder, deck.basics);
        deck.seats.push({
          userid: null,
          username: `Bot ${botNumber}: ${colors.join(', ')}`,
          name: `Draft of ${cube.name}`,
          description: `This deck was built by a bot with preference for ${colors.join(', ')}`,
          deck: builtDeck,
          sideboard,
        });
        botNumber += 1;
      }
    }

    cube.numDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);

    const userq = User.findById(req.user._id);
    const baseuserq = User.findById(base.owner);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner, baseUser] = await Promise.all([userq, cubeOwnerq, baseuserq]);

    if (!cubeOwner._id.equals(user._id) && !cube.disableNotifications) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} rebuilt a deck from your cube: ${cube.name}`,
      );
    }
    if (baseUser && !baseUser._id.equals(user.id)) {
      await util.addNotification(
        baseUser,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} rebuilt your deck from cube: ${cube.name}`,
      );
    }

    await Promise.all([cube.save(), deck.save()]);

    return res.redirect(`/cube/deck/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/404`);
  }
});

router.post('/editdeck/:id', ensureAuth, async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);
    const deckOwner = await User.findById(deck.seats[0].userid);

    if (!deckOwner || !deckOwner._id.equals(req.user._id)) {
      req.flash('danger', 'Unauthorized');
      return res.redirect('/404');
    }

    const cube = await Cube.findOne({ _id: deck.cube });

    await removeDeckCardAnalytics(cube, deck, carddb);

    const newdeck = JSON.parse(req.body.draftraw);
    const name = JSON.parse(req.body.name);
    const description = JSON.parse(req.body.description);

    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = util.fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }
    const cardsArray = [];
    for (const card of deck.toObject().cards) {
      const newCard = { ...card, details: carddb.cardFromId(card.cardID) };
      if (eloOverrideDict[newCard.details.name_lower]) {
        newCard.details.elo = eloOverrideDict[newCard.details.name_lower];
      }
      cardsArray.push(newCard);
    }
    const { colors } = await buildDeck(cardsArray, deck.toObject().seats[0].deck.flat(3), []);
    const colorString =
      colors.length === 0
        ? 'C'
        : cardutil.COLOR_COMBINATIONS.find((comb) => frontutil.arraysAreEqualSets(comb, colors)).join('');

    deck.seats[0].deck = newdeck.playerdeck;
    deck.seats[0].sideboard = newdeck.playersideboard;
    deck.seats[0].name = name;
    deck.seats[0].description = description;
    deck.seats[0].username = `${deckOwner.username}: ${colorString}`;

    await deck.save();
    await addDeckCardAnalytics(cube, deck, carddb);
    await cube.save();

    req.flash('success', 'Deck saved successfully');
    return res.redirect(`/cube/deck/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post('/submitdeck/:id', body('skipDeckbuilder').toBoolean(), async (req, res) => {
  try {
    // req.body contains a draft
    const draftid = req.body.body;
    const draft = await Draft.findById(draftid).lean();
    const cube = await Cube.findOne(buildIdQuery(draft.cube));
    // TODO: Should have guards on if the objects aren't found in the DB.

    const deck = new Deck();
    deck.cube = draft.cube;
    deck.cubeOwner = cube.owner;
    deck.date = Date.now();
    deck.draft = draft._id;
    deck.cubename = cube.name;
    deck.seats = [];
    deck.owner = draft.seats[0].userid;
    deck.cards = draft.cards;
    deck.basics = draft.basics;

    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = util.fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }
    const cards = draft.cards.map((c) => {
      const newCard = { ...c, details: carddb.cardFromId(c.cardID) };
      if (eloOverrideDict[newCard.details.name_lower]) {
        newCard.details.elo = eloOverrideDict[newCard.details.name_lower];
      }
      return newCard;
    });
    let botNumber = 1;
    for (const seat of draft.seats) {
      // eslint-disable-next-line no-await-in-loop
      const { sideboard, deck: newDeck, colors } = await buildDeck(cards, seat.pickorder, draft.basics);
      const colorString =
        colors.length === 0
          ? 'C'
          : cardutil.COLOR_COMBINATIONS.find((comb) => frontutil.arraysAreEqualSets(comb, colors)).join('');
      if (seat.bot) {
        deck.seats.push({
          bot: seat.bot,
          userid: seat.userid,
          username: `Bot ${botNumber}: ${colorString}`,
          name: `Draft of ${cube.name}`,
          description: '',
          deck: newDeck,
          sideboard,
        });
        botNumber += 1;
      } else {
        deck.seats.push({
          bot: seat.bot,
          userid: seat.userid,
          username: `${seat.name}: ${colorString}`,
          name: `Draft of ${cube.name}`,
          description: '',
          deck: seat.drafted,
          sideboard: seat.sideboard ? seat.sideboard : [],
        });
      }
    }

    const userq = User.findById(deck.seats[0].userid);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner] = await Promise.all([userq, cubeOwnerq]);

    if (user && !cube.disableNotifications) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} drafted your cube: ${cube.name}`,
      );
    } else if (!cube.disableNotifications) {
      await util.addNotification(
        cubeOwner,
        { user_from_name: 'Anonymous', user_from: '404' },
        `/cube/deck/${deck._id}`,
        `An anonymous user drafted your cube: ${cube.name}`,
      );
    }

    cube.numDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);

    await Promise.all([cube.save(), deck.save(), cubeOwner.save()]);
    if (req.body.skipDeckbuilder) {
      return res.redirect(`/cube/deck/${deck._id}`);
    }
    return res.redirect(`/cube/deck/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/submitgriddeck/:id', body('skipDeckbuilder').toBoolean(), async (req, res) => {
  try {
    // req.body contains a draft
    const draftid = req.body.body;
    const draft = await GridDraft.findById(draftid).lean();
    const cube = await Cube.findOne(buildIdQuery(draft.cube));

    const deck = new Deck();
    deck.cube = draft.cube;
    deck.date = Date.now();
    deck.draft = draft._id;
    deck.cubename = cube.name;
    deck.seats = [];
    deck.cards = draft.cards;
    deck.basics = draft.basics;

    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = util.fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }
    const cards = draft.cards.map((c) => {
      const newCard = { ...c, details: carddb.cardFromId(c.cardID) };
      if (eloOverrideDict[newCard.details.name_lower]) {
        newCard.details.elo = eloOverrideDict[newCard.details.name_lower];
      }
      return newCard;
    });
    const botNumber = 1;
    for (const seat of draft.seats) {
      // eslint-disable-next-line no-await-in-loop
      const { sideboard, deck: newDeck, colors } = await buildDeck(cards, seat.pickorder, draft.basics);
      const colorString =
        colors.length > 0
          ? 'C'
          : cardutil.COLOR_COMBINATIONS.find((comb) => frontutil.arraysAreEqualSets(comb, colors)).join('');
      if (seat.bot) {
        deck.seats.push({
          bot: seat.bot,
          userid: seat.userid,
          username: `Bot ${botNumber}: ${colorString}`,
          name: `Draft of ${cube.name}`,
          description: '',
          deck: newDeck,
          sideboard,
        });
      } else {
        deck.seats.push({
          bot: seat.bot,
          userid: seat.userid,
          username: `${seat.name}: ${colorString}`,
          name: `Draft of ${cube.name}`,
          description: '',
          deck: seat.drafted,
          sideboard: seat.sideboard ? seat.sideboard : [],
        });
      }
    }

    const userq = User.findById(deck.seats[0].userid);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner] = await Promise.all([userq, cubeOwnerq]);

    if (user && !cube.disableNotifications) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} drafted your cube: ${cube.name}`,
      );
    }

    if (!cube.numDecks) {
      cube.numDecks = 0;
    }
    cube.numDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);

    await Promise.all([cube.save(), deck.save(), cubeOwner.save()]);
    if (req.body.skipDeckbuilder) {
      return res.redirect(`/cube/deck/${deck._id}`);
    }
    return res.redirect(`/cube/deck/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
  }
});

router.get('/redraft/:id/:seat', async (req, res) => {
  try {
    const base = await Deck.findById(req.params.id).lean();
    if (!(base && base.draft)) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }

    const seat = parseInt(req.params.seat, 10);
    if (!Number.isInteger(seat) || seat < 0 || seat >= base.seats.length) {
      req.flash('dangeer', 'Invalid seat index to redraft as.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    // TODO: Handle gridDraft
    const srcDraft = await Draft.findById(base.draft).lean();
    if (!srcDraft) {
      req.flash('danger', 'This deck is not able to be redrafted.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const cube = await Cube.findById(srcDraft.cube);
    if (!cube) {
      req.flash('danger', 'The cube that this deck belongs to no longer exists.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const draft = new Draft();
    draft.cube = srcDraft.cube;
    draft.seats = srcDraft.seats.slice();
    rotateArrayLeft(draft.seats, seat);
    draft.cards = srcDraft.cards;
    draft.basics = srcDraft.basics;
    draft.initial_state = srcDraft.initial_state.slice();

    for (let i = 0; i < draft.seats.length; i += 1) {
      draft.seats[i].drafted = createPool();
      draft.seats[i].sideboard = createPool();
      draft.seats[i].pickorder = [];
    }
    draft.seats[0].userid = req.user ? req.user._id : null;
    draft.seats[0].name = req.user ? req.user.username : 'Anonymous';

    await draft.save();
    return res.redirect(`/cube/draft/${draft._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.post('/uploaddecklist/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found.');
      return res.redirect('/404');
    }

    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }

    const cards = req.body.body.match(/[^\r\n]+/g);
    if (!cards) {
      req.flash('danger', 'No cards detected');
      return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }

    const cardList = [];

    const added = [];
    for (let i = 0; i < 16; i += 1) {
      added.push([]);
    }

    for (let i = 0; i < cards.length; i += 1) {
      const item = cards[i].toLowerCase().trim();
      const numericMatch = item.match(/([0-9]+)x? (.*)/);
      if (numericMatch) {
        let count = parseInt(numericMatch[1], 10);
        if (!Number.isInteger(count)) {
          count = 1;
        }
        for (let j = 0; j < count; j += 1) {
          cards.push(numericMatch[2]);
        }
      } else {
        let selected = null;
        // does not have set info
        const normalizedName = cardutil.normalizeName(item);
        const potentialIds = carddb.getIdsFromName(normalizedName);
        if (potentialIds && potentialIds.length > 0) {
          const inCube = cube.cards.find((card) => carddb.cardFromId(card.cardID).name_lower === normalizedName);
          if (inCube) {
            selected = {
              finish: inCube.finish,
              imgBackUrl: inCube.imgBackUrl,
              imgUrl: inCube.imgUrl,
              cardID: inCube.cardID,
              details: carddb.cardFromId(inCube.cardID),
            };
          } else {
            const reasonableCard = carddb.getMostReasonable(normalizedName, cube.defaultPrinting);
            const reasonableId = reasonableCard ? reasonableCard._id : null;
            const selectedId = reasonableId || potentialIds[0];
            selected = {
              cardID: selectedId,
              details: carddb.cardFromId(selectedId),
            };
          }
        }
        if (selected) {
          // push into correct column.
          let column = Math.min(7, selected.cmc !== undefined ? selected.cmc : selected.details.cmc);
          if (!selected.details.type.toLowerCase().includes('creature')) {
            column += 8;
          }
          added[column].push(cardList.length);
          cardList.push(selected);
        }
      }
    }

    const deck = new Deck();
    deck.cards = cardList;
    deck.date = Date.now();
    deck.cubename = cube.name;
    deck.cube = cube._id;
    deck.cubeOwner = cube.owner;
    deck.owner = req.user._id;
    deck.seats = [
      {
        userid: req.user._id,
        username: req.user.username,
        name: `${req.user.username}'s decklist upload on ${deck.date.toLocaleString('en-US')}`,
        deck: [added.slice(0, 8), added.slice(8, 16)],
        sideboard: createPool(),
      },
    ];
    deck.draft = null;

    await deck.save();

    cube.numDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);

    await cube.save();

    return res.redirect(`/cube/deck/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'null' || req.params.id === 'false') {
      req.flash('danger', 'Invalid deck ID.');
      return res.redirect('/404');
    }

    const deck = await Deck.findById(req.params.id).lean();

    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }

    const cube = await Cube.findOne(buildIdQuery(deck.cube), Cube.LAYOUT_FIELDS).lean();
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }
    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = util.fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }

    for (const card of deck.cards) {
      card.details = carddb.cardFromId(card.cardID);
      if (eloOverrideDict[card.details.name_lower]) {
        card.details.elo = eloOverrideDict[card.details.name_lower];
      }
    }

    let draft = null;
    if (deck.draft) {
      draft = await Draft.findById(deck.draft).lean();
      if (draft && draft.cards) {
        for (const card of draft.cards) {
          card.details = carddb.cardFromId(card.cardID);
          if (eloOverrideDict[card.details.name_lower]) {
            card.details.elo = eloOverrideDict[card.details.name_lower];
          }
        }
      }
    }

    let drafter = 'Anonymous';

    const deckUser = await User.findById(deck.owner);

    if (deckUser) {
      drafter = deckUser.username;
    }

    return render(
      req,
      res,
      'CubeDeckPage',
      {
        cube,
        deck,
        draft,
      },
      {
        title: `${abbreviate(cube.name)} - ${drafter}'s deck`,
        metadata: generateMeta(
          `Cube Cobra Deck: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/deck/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

module.exports = router;
