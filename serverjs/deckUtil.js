const { addDeckCardAnalytics } = require('./cubefn');
const { addNotification } = require('./util');
const carddb = require('./cards');
const { buildDeck } = require('../dist/drafting/deckutil');
const { COLOR_COMBINATIONS } = require('../dist/utils/Card');
const { arraysAreEqualSets } = require('../dist/utils/Util');

const Cube = require('../dynamo/models/cube');
const Deck = require('../models/deck');
const User = require('../dynamo/models/user');

const createDeckFromDraft = async (draft) => {
  const cube = await Cube.getById(draft.cube);

  const deck = new Deck();
  deck.cube = draft.cube;
  deck.cubeOwner = cube.Owner;
  deck.date = Date.now();
  deck.draft = draft._id;
  deck.cubename = cube.Name;
  deck.seats = [];
  deck.owner = draft.seats[0].userid;
  deck.cards = draft.cards;
  deck.basics = draft.basics;

  let botNumber = 1;
  for (const seat of draft.seats) {
    // eslint-disable-next-line no-await-in-loop
    const { sideboard, deck: newDeck, colors } = await buildDeck(draft.cards, seat.pickorder, draft.basics);
    const colorString =
      colors.length === 0 ? 'C' : COLOR_COMBINATIONS.find((comb) => arraysAreEqualSets(comb, colors)).join('');

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
      botNumber += 1;
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
    await addNotification(
      cubeOwner,
      user,
      `/cube/deck/${deck._id}`,
      `${user.Username} drafted your cube: ${cube.Name}`,
    );
  }

  cube.NumDecks += 1;
  await addDeckCardAnalytics(cube, deck, carddb);

  await Cube.update(cube);
  await Promise.all([deck.save(), cubeOwner.save()]);

  return deck;
};

module.exports = {
  createDeckFromDraft,
};
