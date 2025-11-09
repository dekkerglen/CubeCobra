import carddb, { cardFromId, getReasonableCardByOracle } from './carddb';
const { draft, build } = require('./ml');

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

const draftbotPick = (drafterState) => {
  const { cardsInPack, picked } = drafterState;

  const packOracles = cardsInPack.map((oracle) => cardFromId(carddb.oracleToId[oracle][0]).oracle_id);
  const poolOracles = picked.map((oracle) => cardFromId(carddb.oracleToId[oracle][0]).oracle_id);

  const result = draft(packOracles, poolOracles);

  if (result.length === 0) {
    // we don't recognize any of these oracle ids
    return 0;
  }

  return cardsInPack.indexOf(result[0].oracle);
};

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
    const details = cardFromId(carddb.oracleToId[oracle][0]);

    if (!details.type.includes('Land')) {
      count += 1;
      for (const color of details.color_identity) {
        colors[color] += 1;
      }
    }
  }

  const threshold = 0.25;

  const colorKeysFiltered = Object.keys(colors).filter((color) => colors[color] / count > threshold);

  if (colorKeysFiltered.length === 0) {
    return ['C'];
  }

  return colorKeysFiltered;
};

const listOverlaps = (lista, listb) => {
  if (lista.length === 0 || listb.length === 0) {
    return true;
  }

  const setb = new Set(listb);
  return lista.filter((x) => setb.has(x)).length > 0;
};

const pipsPerSource = (cards) => {
  const pips = {
    W: 0.0,
    U: 0.0,
    B: 0.0,
    R: 0.0,
    G: 0.0,
  };

  const sources = {
    W: 1.0,
    U: 1.0,
    B: 1.0,
    R: 1.0,
    G: 1.0,
  };

  for (const card of cards) {
    if (card.type.includes('Land')) {
      for (const color of card.color_identity) {
        sources[color] += 1;
      }
    } else {
      for (const color of card.parsed_cost) {
        if (Object.keys(pips).includes(color.toUpperCase())) {
          pips[color.toUpperCase()] += 1;
        }
      }
    }
  }

  return {
    W: pips.W / sources.W,
    U: pips.U / sources.U,
    B: pips.B / sources.B,
    R: pips.R / sources.R,
    G: pips.G / sources.G,
  };
};

const calculateBasics = (mainboard, basics) => {
  if (basics.length === 0) {
    return [];
  }

  const result = [];

  const basicsNeeded = 40 - mainboard.length;

  const basicLands = basics.filter((card) => card.type.includes('Land'));
  //Cube basics don't have to be actual land cards (could be land art cards or just regular cards).
  //We need lands though in order to calculate pip sources and if none are found we bail, and the bot gets no basics added
  if (basicLands.length === 0) {
    return [];
  }

  for (let i = 0; i < basicsNeeded; i++) {
    const pips = pipsPerSource([...mainboard, ...result]);

    let bestBasic = 0;
    let score = basicLands[0].color_identity.map((color) => pips[color]).reduce((a, b) => a + b, 0);
    //Cube's are not restricted to having 1 of each basic land. Could have multiple of a basic land type or none of a type
    for (let j = 1; j < basicLands.length; j++) {
      const newScore = basicLands[j].color_identity.map((color) => pips[color]).reduce((a, b) => a + b, 0);
      if (newScore > score) {
        bestBasic = j;
        score = newScore;
      }
    }

    result.push(basicLands[bestBasic]);
  }

  return result;
};

export const deckbuild = (pool, basics) => {
  const poolOracles = pool.map((card) => card.oracle_id);

  const result = build(poolOracles);

  const nonlands = result.filter((item) => !cardFromId(carddb.oracleToId[item.oracle][0]).type.includes('Land'));
  const lands = result.filter((item) => cardFromId(carddb.oracleToId[item.oracle][0]).type.includes('Land'));

  const mainboard = nonlands.map((item) => item.oracle).slice(0, 23);
  const sideboard = [];
  if (nonlands.length > 23) {
    sideboard.push(...nonlands.map((item) => item.oracle).slice(24));
  }

  const colors = assessColors(mainboard).filter((color) => color !== 'C');

  const landsInColors = lands.filter((item) =>
    listOverlaps(colors, getReasonableCardByOracle(item.oracle).color_identity),
  );

  mainboard.push(...landsInColors.slice(0, 17).map((item) => item.oracle));

  if (landsInColors.length >= 17) {
    sideboard.push(...landsInColors.slice(17).map((item) => item.oracle));
  }

  mainboard.push(...calculateBasics(mainboard.map(getReasonableCardByOracle), basics).map((card) => card.oracle_id));

  return {
    mainboard: mainboard.sort(),
    sideboard: sideboard.sort(),
  };
};

module.exports = {
  draftbotPick,
  deckbuild,
  calculateBasics,
};
