const express = require('express');
const fetch = require('node-fetch');
const events = require('events');
const CardRating = require('../models/cardrating');
const Cube = require('../models/cube');
const Draft = require('../models/draft');
const util = require('../serverjs/util.js');
const Deck = require('../models/deck');
const carddb = require('../serverjs/cards.js');
const secrets = require('../../cubecobrasecrets/secrets');
const User = require('../models/user');
const { arrayShuffle, arrayIsSubset } = require('../dist/utils/Util.js');
const { buildIdQuery } = require('../serverjs/cubefn.js');

const fetchLands = {
  'Arid Mesa': ['W', 'R'],
  'Bloodstained Mire': ['B', 'R'],
  'Flooded Strand': ['W', 'U'],
  'Marsh Flats': ['W', 'B'],
  'Misty Rainforest': ['U', 'G'],
  'Polluted Delta': ['U', 'B'],
  'Scalding Tarn': ['U', 'R'],
  'Verdant Catacombs': ['B', 'G'],
  'Windswept Heath': ['W', 'G'],
  'Wooded Foothills': ['R', 'G'],
  'Prismatic Vista': ['W', 'U', 'B', 'R', 'G'],
  'Fabled Passage': ['W', 'U', 'B', 'R', 'G'],
};

function pack(draft) {
  return draft.seats[0].packbacklog[0] || [];
}

function packPickNumber(draft) {
  let picks = draft.seats[0].pickorder.length;
  let packnum = 0;

  while (draft.initial_state[0][packnum] && picks >= draft.initial_state[0][packnum].length) {
    picks -= draft.initial_state[0][packnum].length;
    packnum += 1;
  }

  return [packnum + 1, picks + 1];
}

function botRating(botColors, card) {
  const details = carddb.cardFromId(card.cardID);
  const colors = fetchLands[details.name] || card.colors || details.color_identity;
  const colorless = colors.length === 0;
  const subset = arrayIsSubset(colors, botColors) && !colorless;
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line || details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[details.name];

  if (isLand) {
    if (subset || (overlap && isFetch)) {
      // For an average-ish Elo of 1300, this boosts by 260 points.
      card.rating *= 1.2;
    } else if (overlap) {
      card.rating *= 1.1;
    }
  } else if (subset || colorless) {
    card.rating *= 1.15;
  } else if (overlap) {
    card.rating *= 1.05;
  }

  return card.rating;
}

async function buildDeck(cards, bot) {
  const nonlands = cards.filter((card) => !card.type_line.toLowerCase().includes('land'));
  const lands = cards.filter((card) => card.type_line.toLowerCase().includes('land'));

  const sortFn = (a, b) => {
    if (bot) {
      return botRating(bot, b) - botRating(bot, a);
    }
    return 0;
  };

  nonlands.sort(sortFn);
  lands.sort(sortFn);

  const main = nonlands.slice(0, 23).concat(lands.slice(0, 17));
  const side = nonlands.slice(23).concat(lands.slice(17));

  const deck = [];
  const sideboard = [];
  for (let i = 0; i < 16; i += 1) {
    deck.push([]);
    if (i < 8) {
      sideboard.push([]);
    }
  }

  for (const card of main) {
    let index = Math.min(card.cmc, 7);
    if (!card.type_line.toLowerCase().includes('creature')) {
      index += 8;
    }
    deck[index].push(card);
  }
  for (const card of side) {
    sideboard[Math.min(card.cmc, 7)].push(card);
  }

  return {
    deck,
    sideboard,
  };
}

function passPack(draft, seatIndex) {
  // TODO: open pack function
  if (draft.unopenedPacks[0].length % 2 === 0) {
    // pass left
    draft.seats[(seatIndex + 1) % draft.seats.length].packbacklog.push(
      draft.seats[seatIndex].packbacklog.splice(0, 1)[0],
    );
  } else {
    // pass right
    const packFrom = draft.seats[seatIndex].packbacklog.splice(0, 1)[0];
    if (seatIndex === 0 || seatIndex === '0') {
      draft.seats[draft.seats.length - 1].packbacklog.push(packFrom);
    } else {
      draft.seats[seatIndex - 1].packbacklog.push(packFrom);
    }
  }
  return draft;
}

function botPicks(draft) {
  // make bots take picks until only human seats have a packbacklog
  while (
    draft.seats.some((seat) => {
      if (!seat.bot) {
        return false;
      }
      return seat.packbacklog.length > 0;
    })
  ) {
    console.log('seat remaining');
    for (let botIndex = 0; botIndex < draft.seats.length; botIndex++) {
      if (draft.seats[botIndex].bot) {
        while (draft.seats[botIndex].packbacklog.length > 0) {
          console.log(`pack remaining in ${botIndex}`);
          const packFrom = draft.seats[botIndex].packbacklog[0];
          if (packFrom.length > 0) {
            const botColors = draft.seats[botIndex].bot;
            const ratedPicks = [];
            const unratedPicks = [];
            for (let cardIndex = 0; cardIndex < packFrom.length; cardIndex++) {
              if (draft.ratings && draft.ratings[packFrom[cardIndex].details.name]) {
                ratedPicks.push(cardIndex);
              } else {
                unratedPicks.push(cardIndex);
              }
            }

            ratedPicks.sort((x, y) => {
              return botRating(botColors, packFrom[y]) - botRating(botColors, packFrom[x]);
            });
            arrayShuffle(unratedPicks);

            const pickOrder = ratedPicks.concat(unratedPicks);
            draft.seats[botIndex].pickorder.push(draft.seats[botIndex].packbacklog[0].splice(pickOrder[0], 1)[0]);
          }
          draft = passPack(draft, botIndex);
        }
      }
    }
  }

  return draft;
}
const ELO_BASE = 400;
const ELO_RANGE = 1600;
const ELO_SPEED = 1000;
async function saveRating(draftID, cardname, packFrom) {
  const draftQ = Draft.findById(draftID);
  const ratingQ = CardRating.findOne({ name: cardname }).then((rating) => rating || new CardRating());
  const packQ = CardRating.find({ name: { $in: packFrom } });

  const [draft, rating, packRatings] = await Promise.all([draftQ, ratingQ, packQ]);

  if (draft) {
    let picks = draft.seats[0].length;
    let packnum = 1;
    while (picks > draft.initial_state[packnum - 1].length) {
      picks -= draft.initial_state[packnum - 1].length;
      packnum += 1;
    }

    if (!rating.elo) {
      rating.name = cardname;
      rating.elo = ELO_BASE + ELO_RANGE / 2;
    }

    if (!Number.isFinite(rating.elo)) {
      rating.elo = ELO_BASE + ELO_RANGE / (1 + ELO_SPEED ** -(0.5 - rating.value));
    }
    // Update ELO.
    for (const other of packRatings) {
      if (!Number.isFinite(other.elo)) {
        if (!Number.isFinite(other.value)) {
          other.elo = ELO_BASE + ELO_RANGE / 2;
        } else {
          other.elo = ELO_BASE + ELO_RANGE / (1 + ELO_SPEED ** -(0.5 - other.value));
        }
      }

      const diff = other.elo - rating.elo;
      // Expected performance for pick.
      const expectedA = 1 / (1 + 10 ** (diff / 400));
      const expectedB = 1 - expectedA;
      const adjustmentA = 2 * (1 - expectedA);
      const adjustmentB = 2 * (0 - expectedB);
      rating.elo += adjustmentA;
      other.elo += adjustmentB;
    }
    await Promise.all([rating.save(), packRatings.map((r) => r.save())]);
  }
}

async function finish(draft) {
  // build bot decks
  const decks = await Promise.all(draft.seats.map((seat) => buildDeck(seat.pickorder, seat.bot)));

  for (let i = 0; i < draft.seats.length; i++) {
    if (draft.seats[i].bot) {
      draft.seats[i].drafted = decks[i].deck;
      draft.seats[i].sideboard = decks[i].sideboard;
      draft.seats[i].name = `Bot ${i + 1}: ${draft.seats[i].bot[0]}, ${draft.seats[i].bot[1]}`;
      draft.seats[
        i
      ].description = `This deck was drafted by a bot with color preference for ${draft.seats[i].bot[0]} and ${draft.seats[i].bot[1]}.`;
    }
    delete draft.seats[i]._id;
  }

  draft.finished = true;
  return draft;
}

const pick = async (draft, seat, cardIndex) => {
  const card = draft.seats[seat].packbacklog[0].splice(cardIndex, 1)[0];
  draft.seats[seat].pickorder.push(card);

  let index = Math.min(card.cmc || 0, 7);
  if (!card.type_line.toLowerCase().includes('creature')) {
    index += 8;
  }
  draft.seats[seat].drafted[index].push(card);

  const packFrom = draft.seats[seat].packbacklog[0];
  draft = passPack(draft, seat);
  draft = botPicks(draft);

  // open new pack if needed
  if (draft.seats.every((draftseat) => draftseat.packbacklog.length === 0 || draftseat.packbacklog[0].length === 0)) {
    console.log('opening new pack');

    if (draft.unopenedPacks[0].length > 0) {
      // give new pack
      for (let i = 0; i < draft.seats.length; i++) {
        draft.seats[i].packbacklog = draft.unopenedPacks[i].splice(0, 1);

        console.log(draft.seats[i]);
      }
    } else {
      // draft is finished
      draft = finish(draft);
    }
  }

  await saveRating(
    draft._id,
    carddb.cardFromId(card.cardID).name,
    packFrom.map((packcard) => carddb.cardFromId(packcard.cardID).name),
  );

  return draft;
};

const makeDeck = async (draft) => {
  const cube = await Cube.findOne(buildIdQuery(draft.cube));

  const deck = new Deck();
  deck.cube = draft.cube;
  deck.date = Date.now();
  deck.comments = [];
  deck.draft = draft._id;
  deck.cubename = cube.name;
  deck.seats = [];

  for (const seat of draft.seats) {
    deck.seats.push({
      bot: seat.bot,
      userid: seat.userid,
      username: seat.name,
      pickorder: seat.pickorder,
      name: `Draft of ${cube.name}`,
      description: '',
      cols: 16,
      deck: seat.drafted,
      sideboard: seat.sideboard ? seat.sideboard : [],
    });
  }

  if (!cube.decks) {
    cube.decks = [];
  }

  cube.decks.push(deck._id);
  if (!cube.numDecks) {
    cube.numDecks = 0;
  }

  cube.numDecks += 1;
  const userq = User.findById(deck.seats[0].owner);
  const cubeOwnerq = User.findById(cube.owner);

  const [user, cubeOwner] = await Promise.all([userq, cubeOwnerq]);

  cube.decks.push(deck._id);

  if (user) {
    await util.addNotification(
      cubeOwner,
      user,
      `/cube/deck/${deck._id}`,
      `${user.username} drafted your cube: ${cube.name}`,
    );
  }

  await Promise.all([cube.save(), deck.save(), cubeOwner.save()]);

  return deck;
};

module.exports = (io) => {
  const router = express.Router();
  const eventEmitter = new events.EventEmitter();

  async function update(draftid, data) {
    await Promise.all(
      secrets.cluster.map((address) =>
        fetch(`${address}/draft/update/${draftid}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cobra-token': secrets.token,
          },
          body: JSON.stringify(data),
        }),
      ),
    );
  }

  io.sockets.on('connection', (socket) => {
    socket.on('register', (param) => {
      socket.draft = param.draft;
      socket.seat = param.seat;
      socket.join(param.draft);
      console.log(`Seat ${param.seat} of ${param.draft} connected.`);

      if (eventEmitter.listeners(socket.draft).length <= 0) {
        // TODO remove all listeners when draft is completed, otherwise this will leak!
        eventEmitter.on(socket.draft, async () => {
          const draft = await Draft.findById(socket.draft);
          if (draft.finished) {
            io.to(socket.draft).emit('finish', draft.deck);
          } else {
            io.to(socket.draft).emit(
              'update',
              (draft.seats[socket.seat].packbacklog.length > 0 ? draft.seats[socket.seat].packbacklog[0] : []).map(
                (packcard) => ({
                  details: carddb.cardFromId(packcard.cardID),
                  ...packcard,
                }),
              ),
            );
          }
        });
      }
    });
  });

  router.post(
    '/update/:id',
    util.wrapAsyncApi(async (req, res) => {
      if (req.headers['cobra-token'] !== secrets.token) {
        res.status(401).send({
          success: 'true',
        });
      }
      res.status(200).send({
        success: 'true',
      });
      eventEmitter.emit(req.params.id);
    }),
  );

  router.post('/pick/:id/:seat/:index', async (req, res) => {
    let draft = await Draft.findById(req.params.id).lean();
    const seatIndex = req.params.seat;

    if (draft.seats[seatIndex].bot) {
      return res.status(400).send({
        message: 'Attempted to make a pick for a bot seat.',
        success: 'false',
      });
    }

    if (draft.seats[seatIndex].userid && req.user && !req.user._id.equals(draft.seats[seatIndex].userid)) {
      return res.status(401).send({
        message: 'Unauthorized: Must be logged in as correct user to pick for this seat.',
        success: 'false',
      });
    }

    draft = await pick(draft, seatIndex, req.params.index);
    if (draft.finished) {
      const deck = await makeDeck(draft);
      draft.deck = deck._id;
    }
    await Draft.updateOne({ _id: draft._id }, draft);

    await update(req.params.id, draft);

    return res.status(200).send({
      success: 'true',
    });
  });

  return router;
};
