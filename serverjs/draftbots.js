const carddb = require('./carddb');

/*
  drafterState = {
    cardsInPack: [oracle_id]
    picked: [oracle_id],
    pickNum: number, // 0-Indexed pick number from this pack (so this will be the 5th card they've picked since opening the first pack of the draft).
    numPicks: number, // How many cards were in the pack when it was opened.
    packNum: number, // 0-Indexed pack number
    numPacks: number, // How many packs will this player open
  };
  */

const assessColors = (oracles) => {
  const colors = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
  };

  let count = 0;
  for (const oracle of oracles) {
    const details = carddb.cardFromId(carddb.oracleToId(oracle)[0]._id);

    if (!details.type.includes('Land')) {
      count += 1;
      for (const color of details.color_identity) {
        colors[color] += 1;
      }
    }
  }

  const threshold = 0.1;

  const colorKeysFiltered = Object.keys(colors).filter((color) => colors[color] / count > threshold);

  if (colorKeysFiltered.length === 0) {
    return ['C'];
  }

  return colorKeysFiltered;
};

const draftbotPick = (drafterState) => {
  const { cardsInPack, picked } = drafterState;

  const colors = assessColors(picked);

  let toPick = cardsInPack.map((oracle) => carddb.cardFromId(carddb.oracleToId(oracle)[0]._id));

  if (colors.length > 2) {
    // filter out cards that don't match the colors
    toPick = toPick.filter((card) => {
      for (const color of card.color) {
        if (!colors.includes(color)) {
          return false;
        }
      }
      return true;
    });
  }

  // get the oracle id of the highest elo card
  const highestElo = toPick.reduce((acc, card) => {
    if (card.elo > acc.elo) {
      return card;
    }
    return acc;
  });

  return cardsInPack.indexOf(highestElo.oracle_id);
};

module.exports = {
  draftbotPick,
};
