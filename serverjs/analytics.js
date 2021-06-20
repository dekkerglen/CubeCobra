const { winston } = require('./cloudwatch');
const CardRating = require('../models/cardrating');
const CubeAnalytic = require('../models/cubeAnalytic');

const { getDrafterState } = require('../dist/drafting/draftutil');

const { ELO_BASE, ELO_SPEED, CUBE_ELO_SPEED } = require('../routes/cube/helper');

const getEloAdjustment = (winner, loser, speed) => {
  const diff = loser - winner;
  // Expected performance for pick.
  const expectedA = 1 / (1 + 10 ** (diff / 400));
  const expectedB = 1 - expectedA;
  const adjustmentA = (1 - expectedA) * speed;
  const adjustmentB = (0 - expectedB) * speed;
  return [adjustmentA, adjustmentB];
};

const newCardAnalytics = (cardName, elo) => {
  return {
    cardName,
    picks: 0,
    passes: 0,
    elo,
    mainboards: 0,
    sideboards: 0,
  };
};

const removeDeckCardAnalytics = async (cube, deck, carddb) => {
  // we don't want to save deck analytics for decks have not been built
  if (deck.seats[0].sideboard.flat().length > 0) {
    let analytic = await CubeAnalytic.findOne({ cube: cube._id });

    if (!analytic) {
      analytic = new CubeAnalytic();
      analytic.cube = cube._id;
    }

    for (const row of deck.seats[0].deck) {
      for (const col of row) {
        for (const ci of col) {
          let pickIndex = analytic.cards.findIndex(
            (card) => card.cardName === carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(),
          );
          if (pickIndex === -1) {
            pickIndex =
              analytic.cards.push(newCardAnalytics(carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(), 1200)) -
              1;
          }
          analytic.cards[pickIndex].mainboards = Math.max(0, analytic.cards[pickIndex].mainboards - 1);
        }
      }
    }
    for (const row of deck.seats[0].sideboard) {
      for (const col of row) {
        for (const ci of col) {
          let pickIndex = analytic.cards.findIndex(
            (card) => card.cardName === carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(),
          );
          if (pickIndex === -1) {
            pickIndex =
              analytic.cards.push(newCardAnalytics(carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(), 1200)) -
              1;
          }
          analytic.cards[pickIndex].sideboards = Math.max(0, analytic.cards[pickIndex].sideboards - 1);
        }
      }
    }

    await analytic.save();
  }
};

const addDeckCardAnalytics = async (cube, deck, carddb) => {
  // we don't want to save deck analytics for decks have not been built
  if (deck.seats[0].sideboard.flat().length > 0) {
    let analytic = await CubeAnalytic.findOne({ cube: cube._id });

    if (!analytic) {
      analytic = new CubeAnalytic();
      analytic.cube = cube._id;
    }

    for (const row of deck.seats[0].deck) {
      for (const col of row) {
        for (const ci of col) {
          let pickIndex = analytic.cards.findIndex(
            (card) => card.cardName === carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(),
          );
          if (pickIndex === -1) {
            pickIndex =
              analytic.cards.push(newCardAnalytics(carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(), 1200)) -
              1;
          }
          analytic.cards[pickIndex].mainboards += 1;
        }
      }
    }
    for (const row of deck.seats[0].sideboard) {
      for (const col of row) {
        for (const ci of col) {
          let pickIndex = analytic.cards.findIndex(
            (card) => card.cardName === carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(),
          );
          if (pickIndex === -1) {
            pickIndex =
              analytic.cards.push(newCardAnalytics(carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(), 1200)) -
              1;
          }
          analytic.cards[pickIndex].sideboards += 1;
        }
      }
    }
    await analytic.save();
  }
};

const saveDraftAnalytics = async (draft, seatNumber, carddb) => {
  try {
    // first get all the card rating objects we need
    const cards = await CardRating.find(
      {
        name: {
          $in: draft.cards.map(({ cardID }) => carddb.cardFromId(cardID).name),
        },
      },
      'elo picks name',
    );

    const nameToCardAnalytic = {};
    for (const analytic of cards) {
      nameToCardAnalytic[analytic.name] = analytic;
    }

    // fetch the cube analytic
    let analytic = await CubeAnalytic.findOne({ cube: draft.cube });

    if (!analytic) {
      analytic = new CubeAnalytic();
      analytic.cube = draft.cube;
    }

    const { pickorder, trashorder } = draft.seats[seatNumber];
    const numToTake = pickorder.length + trashorder.length;
    let prevPickedNum = 0;
    for (let pickNumber = 0; pickNumber <= numToTake; pickNumber++) {
      const { cardsInPack, pickedNum } = getDrafterState({ draft, seatNumber, pickNumber }, true);
      let pickedIndex = -1;

      if (pickedNum > prevPickedNum) {
        pickedIndex = pickorder[prevPickedNum];
      }
      prevPickedNum = pickedNum;

      if (pickedIndex !== -1) {
        const pickedCard = carddb.cardFromId(draft.cards[pickedIndex].cardID);
        const packCards = cardsInPack.map((index) => carddb.cardFromId(draft.cards[index].cardID));

        // update the local values of the cubeAnalytic
        let pickIndex = analytic.cards.findIndex((card) => card.cardName === pickedCard.name_lower);
        if (pickIndex === -1) {
          pickIndex = analytic.cards.push(newCardAnalytics(pickedCard.name_lower, ELO_BASE)) - 1;
        }

        analytic.cards[pickIndex].picks += 1;

        for (const packCard of packCards) {
          let index = analytic.cards.findIndex((card) => card.cardName === packCard.name_lower);
          if (index === -1) {
            index = analytic.cards.push(newCardAnalytics(packCard.name_lower, ELO_BASE)) - 1;
          }

          const adjustments = getEloAdjustment(
            analytic.cards[pickIndex].elo,
            analytic.cards[index].elo,
            CUBE_ELO_SPEED,
          );
          analytic.cards[pickIndex].elo += adjustments[0];
          analytic.cards[index].elo += adjustments[1];

          analytic.cards[index].passes += 1;
        }

        // update the local values of the cardAnalytics.

        // ensure we have valid analytics for all these cards
        if (!nameToCardAnalytic[pickedCard.name]) {
          nameToCardAnalytic[pickedCard.name] = new CardRating();
        }
        if (!nameToCardAnalytic[pickedCard.name].elo) {
          nameToCardAnalytic[pickedCard.name].name = pickedCard.name;
          nameToCardAnalytic[pickedCard.name].elo = ELO_BASE;
        } else if (!Number.isFinite(nameToCardAnalytic[pickedCard.name].elo)) {
          nameToCardAnalytic[pickedCard.name].elo = ELO_BASE;
        }
        if (!nameToCardAnalytic[pickedCard.name].picks) {
          nameToCardAnalytic[pickedCard.name].picks = 0;
        }
        nameToCardAnalytic[pickedCard.name].picks += 1;

        for (const packCard of packCards) {
          if (!nameToCardAnalytic[packCard.name]) {
            nameToCardAnalytic[packCard.name] = new CardRating();
          }
          if (!nameToCardAnalytic[packCard.name].elo) {
            nameToCardAnalytic[packCard.name].name = packCard.name;
            nameToCardAnalytic[packCard.name].elo = ELO_BASE;
          }
          if (!nameToCardAnalytic[packCard.name].picks) {
            nameToCardAnalytic[packCard.name].picks = 0;
          }

          if (!Number.isFinite(nameToCardAnalytic[packCard.name].elo)) {
            nameToCardAnalytic[packCard.name].elo = ELO_BASE;
          }

          // update the elos
          const adjustments = getEloAdjustment(
            nameToCardAnalytic[pickedCard.name].elo,
            nameToCardAnalytic[packCard.name].elo,
            ELO_SPEED,
          );

          nameToCardAnalytic[pickedCard.name].elo += adjustments[0];
          nameToCardAnalytic[packCard.name].elo += adjustments[1];
        }
      }
    }
    // save our docs
    await analytic.save();
    await Promise.all(cards.map((card) => card.save()));
  } catch (err) {
    winston.error(err);
  }
};

module.exports = {
  saveDraftAnalytics,
  removeDeckCardAnalytics,
  addDeckCardAnalytics,
  newCardAnalytics,
  getEloAdjustment,
};
