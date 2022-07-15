const express = require('express');
const { body } = require('express-validator');
const carddb = require('../../serverjs/cards');
const { buildDeck } = require('../../dist/drafting/deckutil');
const { render } = require('../../serverjs/render');
const util = require('../../serverjs/util');
const generateMeta = require('../../serverjs/meta');
const cardutil = require('../../dist/utils/Card');
const frontutil = require('../../dist/utils/Util');
const { ensureAuth } = require('../middleware');
const { createDeckFromDraft } = require('../../serverjs/deckUtil');
const { createLobby } = require('../../serverjs/multiplayerDrafting');

const { abbreviate, addDeckCardAnalytics, removeDeckCardAnalytics, isCubeViewable } = require('../../serverjs/cubefn');

const { exportToMtgo, createPool, rotateArrayLeft } = require('./helper');

// Bring in models
const Cube = require('../../dynamo/models/cube');
const Deck = require('../../models/deck');
const User = require('../../dynamo/models/user');
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

    if (!req.user.Id === deck.seats[0].userid && !req.user.Id === deck.cubeOwner) {
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

    const deckOwners = deck.seats.map((seat) => `${seat.userid}`).filter((userid) => userid !== 'null');
    if (!req.user || !deckOwners.includes(`${req.user.id}`)) {
      req.flash('danger', 'Only logged in deck owners can build decks.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const cube = await Cube.getById(deck.cube);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    // add details to cards
    for (const card of deck.cards) {
      card.details = carddb.cardFromId(card.cardID);
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
        title: `${abbreviate(cube.Name)} - Deckbuilder`,
        metadata: generateMeta(
          `Cube Cobra Draft: ${cube.Name}`,
          cube.Description,
          cube.ImageUri,
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

    const cube = await Cube.getById(cubeid);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const decksq = Deck.find(
      {
        cube: cube.Id,
      },
      '_id seats date cube owner cubeOwner',
    )
      .sort({
        date: -1,
      })
      .skip(pagesize * Math.max(req.params.page, 0))
      .limit(pagesize)
      .lean()
      .exec();
    const numDecksq = Deck.countDocuments({
      cube: cube.Id,
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
        activePage: Math.max(req.params.page, 0),
      },
      {
        title: `${abbreviate(cube.Name)} - Draft Decks`,
        metadata: generateMeta(
          `Cube Cobra Decks: ${cube.Name}`,
          cube.Description,
          cube.ImageUri,
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

    if (!base) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }

    const cube = await Cube.getById(base.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect(`/cube/deck/${base._id}`);
    }

    const cardsArray = [];
    for (const card of base.cards) {
      const newCard = { ...card, details: carddb.cardFromId(card.cardID) };
      cardsArray.push(newCard);
    }

    const deck = new Deck();
    deck.cube = base.cube;
    deck.cubeOwner = base.owner;
    deck.date = Date.now();
    deck.cubename = cube.Name;
    deck.draft = base.draft;
    deck.seats = [];
    deck.owner = req.user.Id;
    deck.cards = base.cards;
    deck.basics = base.basics;

    deck.seats.push({
      userid: req.user.Id,
      username: base.seats[index].username,
      name: `${req.user.Username}'s rebuild from ${cube.Name} on ${deck.date.toLocaleString('en-US')}`,
      description: 'This deck was rebuilt from another draft deck.',
      deck: base.seats[index].deck,
      sideboard: base.seats[index].sideboard,
    });
    for (let i = 0; i < base.seats.length; i++) {
      if (i !== index) {
        deck.seats.push({
          userid: null,
          username: base.seats[i].username,
          name: `Draft of ${cube.Name}`,
          description: base.seats[i].description,
          deck: base.seats[i].deck,
          sideboard: base.seats[i].sideboard,
        });
      }
    }

    cube.NumDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);

    const user = await User.getById(req.user.Id);
    const baseUser = await User.getById(base.owner);
    const cubeOwner = await User.getById(cube.Owner);

    if (!cubeOwner._id.equals(user.Id) && !cube.DisableNotifications) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.Username} rebuilt a deck from your cube: ${cube.Name}`,
      );
    }
    if (baseUser && !baseUser.Id === user.Id) {
      await util.addNotification(
        baseUser,
        user,
        `/cube/deck/${deck._id}`,
        `${user.Username} rebuilt your deck from cube: ${cube.Name}`,
      );
    }

    await deck.save();
    await Cube.update(cube);

    return res.redirect(`/cube/deck/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/404`);
  }
});

router.post('/editdeck/:id', ensureAuth, async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    const deckOwners = deck.seats.map((seat) => `${seat.userid}`).filter((userid) => userid !== 'null');

    if (!req.user || !deckOwners.includes(`${req.user.id}`)) {
      req.flash('danger', 'Unauthorized');
      return res.redirect('/404');
    }

    const seatIndex = deck.seats
      .map((seat, index) => [seat, index])
      .find((tuple) => `${tuple[0].userid}` === `${req.user.id}`)[1];

    const cube = await Cube.getById(deck.cube);

    await removeDeckCardAnalytics(cube, deck, carddb);

    const draft = JSON.parse(req.body.draftraw);
    const name = JSON.parse(req.body.name).substring(0, 100);
    const description = JSON.parse(req.body.description).substring(0, 10000);

    const cardsArray = [];
    for (const card of deck.toObject().cards) {
      const newCard = { ...card, details: carddb.cardFromId(card.cardID) };
      cardsArray.push(newCard);
    }
    const { colors } = await buildDeck(cardsArray, deck.toObject().seats[0].deck.flat(3), []);
    const colorString =
      colors.length === 0
        ? 'C'
        : cardutil.COLOR_COMBINATIONS.find((comb) => frontutil.arraysAreEqualSets(comb, colors)).join('');

    deck.seats[seatIndex].deck = draft.playerdeck;
    deck.seats[seatIndex].sideboard = draft.playersideboard;
    deck.seats[seatIndex].name = name;
    deck.seats[seatIndex].description = description;
    deck.seats[seatIndex].username = `${req.user.Username}: ${colorString}`;

    await deck.save();
    await addDeckCardAnalytics(cube, deck, carddb);

    req.flash('success', 'Deck saved successfully');
    return res.redirect(`/cube/deck/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post('/submitdeck/:id', body('skipDeckbuilder').toBoolean(), async (req, res) => {
  try {
    const draftid = req.body.body;
    const draft = await Draft.findById(draftid).lean();

    const deck = await createDeckFromDraft(draft);

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
    if (!draft) {
      req.flash('danger', 'Draft not found');
      return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }
    const cube = await Cube.getById(draft.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/playtest/404');
    }

    const deck = new Deck();
    deck.cube = draft.cube;
    deck.date = Date.now();
    deck.draft = draft._id;
    deck.cubename = cube.Name;
    deck.seats = [];
    deck.cards = draft.cards;
    deck.basics = draft.basics;

    const cards = draft.cards.map((c) => {
      const newCard = { ...c, details: carddb.cardFromId(c.cardID) };
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
          name: `Draft of ${cube.Name}`,
          description: '',
          deck: newDeck,
          sideboard,
        });
      } else {
        deck.seats.push({
          bot: seat.bot,
          userid: seat.userid,
          username: `${seat.name}: ${colorString}`,
          name: `Draft of ${cube.Name}`,
          description: '',
          deck: seat.drafted,
          sideboard: seat.sideboard ? seat.sideboard : [],
        });
      }
    }

    const user = await User.getById(deck.seats[0].userid);
    const cubeOwner = await User.getById(cube.Owner);

    if (user && !cube.DisableNotifications) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.Username} drafted your cube: ${cube.Name}`,
      );
    }

    cube.numDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);

    await deck.save();
    await Cube.update(cube);

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
      req.flash('danger', 'Invalid seat index to redraft as.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    // TODO: Handle gridDraft
    const srcDraft = await Draft.findById(base.draft).lean();
    if (!srcDraft) {
      req.flash('danger', 'This deck is not able to be redrafted.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const cube = await Cube.getById(srcDraft.cube);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'The cube that this deck belongs to no longer exists.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const draft = new Draft();
    draft.cube = srcDraft.cube;
    draft.seats = srcDraft.seats.slice();
    draft.seats = rotateArrayLeft(draft.seats, seat);
    draft.cards = srcDraft.cards;
    draft.basics = srcDraft.basics;
    draft.initial_state = rotateArrayLeft(srcDraft.initial_state.slice(), seat);

    for (let i = 0; i < draft.seats.length; i += 1) {
      draft.seats[i].drafted = createPool();
      draft.seats[i].sideboard = createPool();
      draft.seats[i].pickorder = [];
    }
    draft.seats[0].userid = req.user ? req.user.Id : null;
    draft.seats[0].name = req.user ? req.user.Username : 'Anonymous';

    await draft.save();
    await createLobby(draft, req.user);
    return res.redirect(`/cube/draft/${draft._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.post('/uploaddecklist/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found.');
      return res.redirect('/404');
    }

    const cubeCards = Cube.getCards(cube);
    const mainboard = cubeCards.boards.filter((b) => b.name === 'Mainboard')[0];

    if (cube.Owner !== req.user.Id) {
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
          const inCube = mainboard.cards.find((card) => carddb.cardFromId(card.cardID).name_lower === normalizedName);
          if (inCube) {
            selected = {
              finish: inCube.finish,
              imgBackUrl: inCube.imgBackUrl,
              imgUrl: inCube.imgUrl,
              cardID: inCube.cardID,
              details: carddb.cardFromId(inCube.cardID),
            };
          } else {
            const reasonableCard = carddb.getMostReasonable(normalizedName, cube.DefaultPrinting);
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
    deck.cubename = cube.Name;
    deck.cube = cube.Id;
    deck.cubeOwner = cube.Owner;
    deck.owner = req.user.Id;
    deck.seats = [
      {
        userid: req.user.Id,
        username: req.user.Username,
        name: `${req.user.Username}'s decklist upload on ${deck.date.toLocaleString('en-US')}`,
        deck: [added.slice(0, 8), added.slice(8, 16)],
        sideboard: createPool(),
      },
    ];

    deck.draft = null;
    await deck.save();

    cube.numDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);
    await Cube.update(cube);

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

    const cube = await Cube.getById(deck.cube);
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    for (const card of deck.cards) {
      card.details = carddb.cardFromId(card.cardID);
    }

    let draft = null;
    if (deck.draft) {
      draft = await Draft.findById(deck.draft).lean();
      if (draft && draft.cards) {
        for (const card of draft.cards) {
          card.details = carddb.cardFromId(card.cardID);
        }
      }
    }

    let drafter = 'Anonymous';

    const deckUser = await User.getById(deck.owner);

    if (deckUser) {
      drafter = deckUser.Username;
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
        title: `${abbreviate(cube.Name)} - ${drafter}'s deck`,
        metadata: generateMeta(
          `Cube Cobra Deck: ${cube.Name}`,
          cube.Description,
          cube.ImageUri,
          `https://cubecobra.com/cube/deck/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

module.exports = router;
