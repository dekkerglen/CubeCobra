const express = require('express');
const { body } = require('express-validator');
const { cardFromId, getIdsFromName, getMostReasonable } = require('../../util/carddb');
const { handleRouteError, render, redirect } = require('../../util/render');
const util = require('../../util/util');
const generateMeta = require('../../util/meta');
const cardutil = require('../../client/utils/cardutil');
const { ensureAuth } = require('../middleware');
const { addBasics } = require('./helper');

const { abbreviate, isCubeViewable } = require('../../util/cubefn');

const { exportToMtgo, createPool } = require('./helper');

// Bring in models
const Cube = require('../../dynamo/models/cube');
const User = require('../../dynamo/models/user');
const Draft = require('../../dynamo/models/draft');

const router = express.Router();

const DECK_CSV_HEADER = 'Quantity,"Name",Scryfall,Zone';

router.get('/download/xmage/:id/:seat', async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);

    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`NAME:${seat.name}\r\n`);
    const main = {};
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = cardFromId(deck.cards[cardIndex].cardID);
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
          const details = cardFromId(deck.cards[cardIndex].cardID);
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
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/forge/:id/:seat', async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`name=${seat.name}\r\n`);
    res.write('[Main]\r\n');
    const main = {};
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = cardFromId(deck.cards[cardIndex].cardID);
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
          const details = cardFromId(deck.cards[cardIndex].cardID);
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
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/txt/:id/:seat', async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const { name } = cardFromId(deck.cards[cardIndex].cardID);
          res.write(`${name}\r\n`);
        }
      }
    }
    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/mtgo/:id/:seat', async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[req.params.seat];
    return exportToMtgo(res, seat.name, seat.mainboard.flat(), seat.sideboard.flat(), deck.cards);
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/arena/:id/:seat', async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('Deck\r\n');
    const main = {};
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = cardFromId(deck.cards[cardIndex].cardID);
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
          const details = cardFromId(deck.cards[cardIndex].cardID);
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
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/cockatrice/:id/:seat', async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    const main = {};
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = cardFromId(deck.cards[cardIndex].cardID);
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

    res.write('sideboard\r\n');
    const side = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const details = cardFromId(deck.cards[cardIndex].cardID);
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
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/topdecked/:id/:seat', async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${req.params.id}_${req.params.seat}.csv`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';

    res.write(`${DECK_CSV_HEADER}\r\n`);

    const main = {};
    const mainCardID = {};
    const mainCardName = {};
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          const oracleId = `${card.details.oracleId}`;
          if (main[oracleId]) {
            main[oracleId] += 1;
          } else {
            main[oracleId] = 1;
            mainCardID[oracleId] = `${card.cardID}`;
            mainCardName[oracleId] = `${card.details.name}`;
          }
        }
      }
    }
    for (const [oracleId, value] of Object.entries(main)) {
      res.write(`${value},"${mainCardName[oracleId]}",${mainCardID[oracleId]},main\r\n`);
    }

    const side = {};
    const sideCardID = {};
    const sideCardName = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          const oracleId = `${card.details.oracleId}`;
          if (side[oracleId]) {
            side[oracleId] += 1;
          } else {
            side[oracleId] = 1;
            sideCardID[oracleId] = `${card.cardID}`;
            sideCardName[oracleId] = `${card.details.name}`;
          }
        }
      }
    }
    for (const [oracleId, value] of Object.entries(side)) {
      res.write(`${value},"${sideCardName[oracleId]}",${sideCardID[oracleId]},side\r\n`);
    }

    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.delete('/deletedeck/:id', ensureAuth, async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);

    if (req.user.id !== deck.owner.id && req.user.id !== deck.cubeOwner.id) {
      req.flash('danger', 'Unauthorized');
      return redirect(req, res, '/404');
    }

    await Draft.delete(deck.id);

    req.flash('success', 'Deck Deleted');
    return res.send('Success');
  } catch {
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting deck.',
    });
  }
});

router.get('/rebuild/:id/:index', ensureAuth, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    const base = await Draft.getById(req.params.id);

    if (!base) {
      req.flash('danger', 'Deck not found');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(base.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, `/cube/deck/${base.id}`);
    }

    const cardsArray = [];
    for (const card of base.cards) {
      const newCard = { ...card, details: cardFromId(card.cardID) };
      cardsArray.push(newCard);
    }

    const deck = {
      cube: base.cube,
      owner: req.user.id,
      cubeOwner: base.cubeOwner.id,
      date: new Date().valueOf(),
      type: base.type,
      seats: [],
      cards: base.cards,
      basics: base.basics,
      InitialState: base.InitialState,
    };
    deck.seats.push({
      ...base.seats[index],
      owner: req.user.id,
      title: `${req.user.username}'s rebuild from ${cube.name}`,
      description: 'This deck was rebuilt from another draft deck.',
    });
    for (let i = 0; i < base.seats.length; i++) {
      if (i !== index) {
        deck.seats.push(base.seats[i]);
      }
    }

    cube.numDecks += 1;

    const user = await User.getById(req.user.id);
    // const baseUser = await User.getById(base.owner);
    // const cubeOwner = await User.getById(cube.owner);

    //TODO: Can remove after fixing models to not muck with the original input
    const cubeOwner = cube.owner;

    const id = await Draft.put(deck);
    await Cube.update(cube);

    if (cube.owner.id !== user.id && !cube.disableAlerts) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${id}`,
        `${user.username} rebuilt a deck from your cube: ${cube.name}`,
      );
    }
    if (base.owner && base.owner.id !== user.id) {
      await util.addNotification(
        base.owner,
        user,
        `/cube/deck/${id}`,
        `${user.username} rebuilt your deck from cube: ${cube.name}`,
      );
    }

    return redirect(req, res, `/draft/deckbuilder/${id}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/404`);
  }
});

router.post('/editdeck/:id', ensureAuth, async (req, res) => {
  try {
    const deck = await Draft.getById(req.params.id);

    if (!req.user) {
      return res.status(401).send({
        success: false,
        message: 'You must be logged in to finish a draft',
      });
    }

    if (typeof deck.owner !== 'string' && deck.owner?.id !== req.user.id) {
      return res.status(401).send({
        success: false,
        message: 'You do not own this draft',
      });
    }

    const { main, side, title, description } = req.body;

    deck.seats[0].mainboard = JSON.parse(main);
    deck.seats[0].sideboard = JSON.parse(side);
    deck.seats[0].title = (title || '').substring(0, 100);
    deck.seats[0].body = (description || '').substring(0, 1000);

    deck.complete = true;

    await Draft.put(deck);

    req.flash('success', 'Deck saved successfully');
    return redirect(req, res, `/cube/deck/${deck.id}`);
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.post('/submitdeck/:id', body('skipDeckbuilder').toBoolean(), async (req, res) => {
  try {
    const draftid = req.body.body;

    if (req.body.skipDeckbuilder) {
      return redirect(req, res, `/cube/deck/${draftid}`);
    }

    return redirect(req, res, `/draft/deckbuilder/${draftid}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/uploaddecklist/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found.');
      return redirect(req, res, '/404');
    }

    const cubeCards = await Cube.getCards(cube.id);
    const { mainboard } = cubeCards;

    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }

    const cards = req.body.body.match(/[^\r\n]+/g);
    if (!cards) {
      req.flash('danger', 'No cards detected');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
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
        const potentialIds = getIdsFromName(normalizedName);
        if (potentialIds && potentialIds.length > 0) {
          const inCube = mainboard.find((card) => cardFromId(card.cardID).name_lower === normalizedName);
          if (inCube) {
            selected = {
              finish: inCube.finish,
              imgBackUrl: inCube.imgBackUrl,
              imgUrl: inCube.imgUrl,
              cardID: inCube.cardID,
              details: cardFromId(inCube.cardID),
            };
          } else {
            const reasonableCard = getMostReasonable(normalizedName, cube.defaultPrinting);
            const reasonableId = reasonableCard ? reasonableCard.scryfall_id : null;
            const selectedId = reasonableId || potentialIds[0];
            selected = {
              cardID: selectedId,
              details: cardFromId(selectedId),
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
      cube: req.params.id,
      owner: req.user.id,
      cubeOwner: cube.owner.id,
      date: new Date().valueOf(),
      type: Draft.TYPES.UPLOAD,
      cards: cardList,
      seats: [
        {
          owner: req.user.id,
          title: `${req.user.username}'s decklist upload`,
          mainboard: [added.slice(0, 8), added.slice(8, 16)],
          sideboard: createPool(),
        },
      ],
      complete: true,
      basics: cube.basics,
    };

    addBasics(deck, cube.basics);

    const id = await Draft.put(deck);

    cube.numDecks += 1;
    await Cube.update(cube);

    return redirect(req, res, `/draft/deckbuilder/${id}`);
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'null' || req.params.id === 'false') {
      req.flash('danger', 'Invalid deck ID.');
      return redirect(req, res, '/404');
    }

    const draft = await Draft.getById(req.params.id);

    if (!draft) {
      req.flash('danger', 'Deck not found');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(draft.cube);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const baseUrl = util.getBaseUrl();
    return render(
      req,
      res,
      'CubeDeckPage',
      {
        cube,
        draft,
      },
      {
        title: `Draft deck of ${abbreviate(cube.name)}`,
        metadata: generateMeta(
          `Cube Cobra Deck: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/deck/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

module.exports = router;
