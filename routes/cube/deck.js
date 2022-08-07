const express = require('express');
const { body } = require('express-validator');
const carddb = require('../../serverjs/cards');
const { render } = require('../../serverjs/render');
const util = require('../../serverjs/util');
const generateMeta = require('../../serverjs/meta');
const cardutil = require('../../dist/utils/Card');
const { ensureAuth } = require('../middleware');
const { createLobby } = require('../../serverjs/multiplayerDrafting');

const { abbreviate, updateDeckCardAnalytics, isCubeViewable } = require('../../serverjs/cubefn');

const { exportToMtgo, createPool } = require('./helper');

// Bring in models
const Cube = require('../../dynamo/models/cube');
const User = require('../../dynamo/models/user');
const Draft = require('../../dynamo/models/draft');

const router = express.Router();

router.get('/download/xmage/:id/:seat', async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);

    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    const seat = deck.Seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.Title.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`NAME:${seat.name}\r\n`);
    const main = {};
    for (const row of seat.Mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.Cards[cardIndex].cardID);
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
    for (const row of seat.Sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.Cards[cardIndex].cardID);
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
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.Seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.Title.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`Name=${seat.name}\r\n`);
    res.write('[Main]\r\n');
    const main = {};
    for (const row of seat.Mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.Cards[cardIndex].cardID);
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
    for (const row of seat.Sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.Cards[cardIndex].cardID);
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
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.Seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const row of seat.Mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const { name } = carddb.cardFromId(deck.Cards[cardIndex].cardID);
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
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.Seats[req.params.seat];
    return exportToMtgo(res, seat.name, seat.Mainboard.flat(), seat.Sideboard.flat(), deck.Cards);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/arena/:id/:seat', async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.Seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('Deck\r\n');
    const main = {};
    for (const row of seat.Mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.Cards[cardIndex].cardID);
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
    for (const row of seat.Sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.Cards[cardIndex].cardID);
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
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.Seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.Title.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    const main = {};
    for (const row of seat.Mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.Cards[cardIndex].cardID);
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
    for (const row of seat.Sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = carddb.cardFromId(deck.Cards[cardIndex].cardID);
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
    const deck = await Draft.getById(req.params.id);

    if (req.user.Id !== deck.Owner && req.user.Id !== deck.CubeOwner) {
      req.flash('danger', 'Unauthorized');
      return res.redirect('/404');
    }

    await Draft.delete(req.params.id);

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
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }

    const deckOwners = deck.Seats.map((seat) => `${seat.Owner}`).filter((userid) => userid);
    if (!req.user || !deckOwners.includes(`${req.user.id}`)) {
      req.flash('danger', 'Only logged in deck owners can build decks.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const cube = await Cube.getById(deck.CubeId);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const imagedata = util.getImageData(cube.ImageName);

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
          imagedata.uri,
          `https://cubecobra.com/cube/draft/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/decks/:cubeid', async (req, res) => {
  try {
    const { cubeid } = req.params;

    const cube = await Cube.getById(cubeid);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const decks = await Draft.getByCubeId(cubeid);

    const imagedata = util.getImageData(cube.ImageName);

    return render(
      req,
      res,
      'CubeDecksPage',
      {
        cube,
        decks: decks.items,
        lastKey: decks.lastKey,
      },
      {
        title: `${abbreviate(cube.Name)} - Draft Decks`,
        metadata: generateMeta(
          `Cube Cobra Decks: ${cube.Name}`,
          cube.Description,
          imagedata.uri,
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
    const base = await Draft.getById(req.params.id);

    if (!base) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }

    const cube = await Cube.getById(base.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect(`/cube/deck/${base.Id}`);
    }

    const cardsArray = [];
    for (const card of base.cards) {
      const newCard = { ...card, details: carddb.cardFromId(card.cardID) };
      cardsArray.push(newCard);
    }

    const deck = {
      CubeId: base.CubeId,
      Owner: req.user.id,
      CubeOwner: base.CubeOwner,
      Date: new Date().valueOf(),
      Type: 'draft',
      Seats: [],
      Cards: base.Cards,
      Basics: base.Basics,
      InitialState: base.InitialState,
    };
    deck.Seats.push({
      ...base.Seats[index],
      Owner: req.user.Id,
      Title: `${req.user.Username}'s rebuild from ${cube.Name}`,
      Description: 'This deck was rebuilt from another draft deck.',
    });
    for (let i = 0; i < base.seats.length; i++) {
      if (i !== index) {
        deck.seats.push(base.seats[i]);
      }
    }

    cube.NumDecks += 1;
    await updateDeckCardAnalytics(cube.Id, null, 0, deck.Seats[0], deck.Cards, carddb);

    const user = await User.getById(req.user.Id);
    const baseUser = await User.getById(base.owner);
    const cubeOwner = await User.getById(cube.Owner);

    if (cubeOwner.Id !== user.Id && !cube.DisableNotifications) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck.Id}`,
        `${user.Username} rebuilt a deck from your cube: ${cube.Name}`,
      );
    }
    if (baseUser && !baseUser.Id === user.Id) {
      await util.addNotification(
        baseUser,
        user,
        `/cube/deck/${deck.Id}`,
        `${user.Username} rebuilt your deck from cube: ${cube.Name}`,
      );
    }

    await deck.save();
    await Cube.update(cube);

    return res.redirect(`/cube/deck/deckbuilder/${deck.Id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/404`);
  }
});

router.post('/editdeck/:id', ensureAuth, async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);

    const deckOwners = deck.Seats.map((seat) => seat.Owner).filter((userid) => userid !== 'null');

    if (!req.user || !deckOwners.includes(`${req.user.id}`)) {
      req.flash('danger', 'Unauthorized');
      return res.redirect('/404');
    }

    const seatIndex = deck.seats
      .map((seat, index) => [seat, index])
      .find((tuple) => `${tuple[0].userid}` === `${req.user.id}`)[1];

    const cube = await Cube.getById(deck.cube);

    const { main, side, title, description } = req.body;

    await updateDeckCardAnalytics(
      cube.Id,
      deck.Seats,
      seatIndex,
      { Mainboard: main, Sideboard: side },
      deck.Cards,
      carddb,
    );

    deck.Seats[seatIndex].Mainboard = main;
    deck.Seats[seatIndex].Sideboard = side;
    deck.Seats[seatIndex].Title = title.substring(0, 100);
    deck.Seats[seatIndex].Body = description.substring(0, 1000);

    await Draft.put(deck);

    req.flash('success', 'Deck saved successfully');
    return res.redirect(`/cube/deck/${deck.Id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post('/submitdeck/:id', body('skipDeckbuilder').toBoolean(), async (req, res) => {
  try {
    const draftid = req.body.body;

    // TODO build bot decks

    if (req.body.skipDeckbuilder) {
      return res.redirect(`/cube/deck/${draftid}`);
    }

    return res.redirect(`/cube/deck/deckbuilder/${draftid}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
  }
});

router.get('/redraft/:id/:seat', ensureAuth, async (req, res) => {
  try {
    const base = await Draft.getById(req.params.id);

    if (!base) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }

    const seat = parseInt(req.params.seat, 10);
    if (!Number.isInteger(seat) || seat < 0 || seat >= base.Seats.length) {
      req.flash('danger', 'Invalid seat index to redraft as.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    // TODO: Handle gridDraft

    const cube = await Cube.getById(base.CubeId);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'The cube that this deck belongs to no longer exists.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const draft = {
      CubeId: base.CubeId,
      Owner: req.user.Id,
      CubeOwner: cube.Owner,
      Date: new Date().valueOf(),
      Type: base.Type,
      InitialState: base.InitialState,
      Basics: base.Basics,
      Cards: base.Cards,
      Seats: [],
    };

    for (let i = 0; i < draft.seats.length; i += 1) {
      draft.Seats[i].deck = createPool();
      draft.Seats[i].sideboard = createPool();
      draft.Seats[i].Pickorder = [];
      draft.Seats[i].Trashorder = [];
    }
    draft.Seats[0].Owner = req.user.Id;

    await Draft.put(draft);

    await createLobby(draft, req.user);
    return res.redirect(`/cube/draft/${draft.Id}`);
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
    const mainboard = cubeCards.Mainboard;

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
          const inCube = mainboard.find((card) => carddb.cardFromId(card.cardID).name_lower === normalizedName);
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

    const deck = {
      CubeId: req.params.id,
      Owner: req.user.Id,
      CubeOwner: cube.Owner,
      Date: new Date().valueOf(),
      Type: Draft.TYPES.UPLOAD,
      Cards: cardList,
      Seats: [
        {
          Owner: req.user.Id,
          Title: `${req.user.Username}'s decklist upload`,
          Mainboard: [added.slice(0, 8), added.slice(8, 16)],
          Sideboard: createPool(),
        },
      ],
    };

    await Draft.put(deck);
    await updateDeckCardAnalytics(cube.Id, null, 0, deck.Seats[0], deck.Cards, carddb);

    cube.numDecks += 1;
    await Cube.update(cube);

    return res.redirect(`/cube/deck/deckbuilder/${deck.Id}`);
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

    const deck = await Draft.getById(req.params.id);

    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }

    const cube = await Cube.getById(deck.cube);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const imagedata = util.getImageData(cube.imgUrl);

    return render(
      req,
      res,
      'CubeDeckPage',
      {
        cube,
        deck,
      },
      {
        title: `Draft deck of ${abbreviate(cube.Name)}`,
        metadata: generateMeta(
          `Cube Cobra Deck: ${cube.Name}`,
          cube.Description,
          imagedata.uri,
          `https://cubecobra.com/cube/deck/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

module.exports = router;
