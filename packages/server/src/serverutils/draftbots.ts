import carddb, { cardFromId, getReasonableCardByOracle } from './carddb';
import { draft as draftbotPick, build } from './ml';

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

const assessColors = (oracles: string[]): string[] => {
  const colors: Record<string, number> = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
  };

  let count = 0;
  for (const oracle of oracles) {
    const oracleIds = carddb.oracleToId[oracle];
    if (!oracleIds || oracleIds.length === 0) continue;

    const details = cardFromId(oracleIds[0]!);

    if (!details.type.includes('Land')) {
      count += 1;
      for (const color of details.color_identity) {
        if (colors[color] !== undefined) {
          colors[color] += 1;
        }
      }
    }
  }

  const threshold = 0.25;

  const colorKeysFiltered = Object.keys(colors).filter((color) => (colors[color] ?? 0) / count > threshold);

  if (colorKeysFiltered.length === 0) {
    return ['C'];
  }

  return colorKeysFiltered;
};

const listOverlaps = (lista: string[], listb: string[]): boolean => {
  if (lista.length === 0 || listb.length === 0) {
    return true;
  }

  const setb = new Set(listb);
  return lista.filter((x: string) => setb.has(x)).length > 0;
};

const pipsPerSource = (cards: any[]): Record<string, number> => {
  const pips: Record<string, number> = {
    W: 0.0,
    U: 0.0,
    B: 0.0,
    R: 0.0,
    G: 0.0,
  };

  const sources: Record<string, number> = {
    W: 1.0,
    U: 1.0,
    B: 1.0,
    R: 1.0,
    G: 1.0,
  };

  for (const card of cards) {
    if (card.type.includes('Land')) {
      for (const color of card.color_identity) {
        if (sources[color] !== undefined) {
          sources[color] += 1;
        }
      }
    } else {
      for (const color of card.parsed_cost) {
        const upperColor = color.toUpperCase();
        if (pips[upperColor] !== undefined) {
          pips[upperColor] += 1;
        }
      }
    }
  }

  return {
    W: (pips.W ?? 0) / (sources.W ?? 1),
    U: (pips.U ?? 0) / (sources.U ?? 1),
    B: (pips.B ?? 0) / (sources.B ?? 1),
    R: (pips.R ?? 0) / (sources.R ?? 1),
    G: (pips.G ?? 0) / (sources.G ?? 1),
  };
};

const calculateBasics = (mainboard: any[], basics: any[]): any[] => {
  if (basics.length === 0) {
    return [];
  }

  const result = [];

  const basicsNeeded = 40 - mainboard.length;

  const basicLands = basics.filter((card: any) => card.type.includes('Land'));
  //Cube basics don't have to be actual land cards (could be land art cards or just regular cards).
  //We need lands though in order to calculate pip sources and if none are found we bail, and the bot gets no basics added
  if (basicLands.length === 0) {
    return [];
  }

  for (let i = 0; i < basicsNeeded; i++) {
    const pips = pipsPerSource([...mainboard, ...result]);

    let bestBasic = 0;
    let score = basicLands[0].color_identity
      .map((color: string) => pips[color] ?? 0)
      .reduce((a: number, b: number) => a + b, 0);
    //Cube's are not restricted to having 1 of each basic land. Could have multiple of a basic land type or none of a type
    for (let j = 1; j < basicLands.length; j++) {
      const newScore = basicLands[j].color_identity
        .map((color: string) => pips[color] ?? 0)
        .reduce((a: number, b: number) => a + b, 0);
      if (newScore > score) {
        bestBasic = j;
        score = newScore;
      }
    }

    result.push(basicLands[bestBasic]);
  }

  return result;
};

export const deckbuild = (pool: any[], basics: any[]): { mainboard: string[]; sideboard: string[] } => {
  const poolOracles = pool.map((card: any) => card.oracle_id);

  const result = build(poolOracles);

  const nonlands = result.filter((item: any) => {
    const oracleIds = carddb.oracleToId[item.oracle];
    return oracleIds && oracleIds[0] && !cardFromId(oracleIds[0]).type.includes('Land');
  });
  const lands = result.filter((item: any) => {
    const oracleIds = carddb.oracleToId[item.oracle];
    return oracleIds && oracleIds[0] && cardFromId(oracleIds[0]).type.includes('Land');
  });

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

export { draftbotPick, calculateBasics };
export default {
  draftbotPick,
  deckbuild,
  calculateBasics,
};
