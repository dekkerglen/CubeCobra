const { addDeckCardAnalytics } = require('./cubefn.js');
const { fromEntries, addNotification } = require('./util.js');
const carddb = require('./cards.js');
const { buildDeck } = require('../dist/drafting/deckutil.js');
const { COLOR_COMBINATIONS } = require('../dist/utils/Card.js');
const { arraysAreEqualSets } = require('../dist/utils/Util.js');

const Cube = require('../models/cube');
const Deck = require('../models/deck');
const CubeAnalytic = require('../models/cubeAnalytic');
const User = require('../models/user');

const createDeckFromDraft = async (draft) => {
  const cube = await Cube.findById(draft.cube);

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
    eloOverrideDict = fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
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
      colors.length === 0 ? 'C' : COLOR_COMBINATIONS.find((comb) => arraysAreEqualSets(comb, colors)).join('');

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
    await addNotification(
      cubeOwner,
      user,
      `/cube/deck/${deck._id}`,
      `${user.username} drafted your cube: ${cube.name}`,
    );
  } else if (!cube.disableNotifications) {
    await addNotification(
      cubeOwner,
      { user_from_name: 'Anonymous', user_from: '404' },
      `/cube/deck/${deck._id}`,
      `An anonymous user drafted your cube: ${cube.name}`,
    );
  }

  cube.numDecks += 1;
  await addDeckCardAnalytics(cube, deck, carddb);

  await Promise.all([cube.save(), deck.save(), cubeOwner.save()]);

  return deck;
};

module.exports = {
  createDeckFromDraft,
};
