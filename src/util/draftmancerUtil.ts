import { detailsToCard } from '../client/utils/cardutil';
import { CardDetails } from '../datatypes/Card';
import { Decklist } from '../datatypes/Draftmancer';
import { getReasonableCardByOracle } from './carddb';
import { deckbuild } from './draftbots';
import { getCardDefaultRowColumn, setupPicks } from './draftutil';

export const upsertCardAndGetIndex = (cards: CardDetails[], oracleId: string): number => {
  const card = getReasonableCardByOracle(oracleId);
  const index = cards.findIndex((c) => c.oracle_id === oracleId);

  if (index === -1) {
    cards.push(card);
    return cards.length - 1;
  }

  return index;
};

export const formatMainboard = (decklist: Decklist, cardDetails: CardDetails[]) => {
  const mainboard: number[][][] = setupPicks(2, 8);

  for (const oracleId of decklist.main) {
    const index = upsertCardAndGetIndex(cardDetails, oracleId);
    const card = cardDetails[index];

    //TODO: Consolidate with draftutil.getCardDefaultRowColumn
    const isCreature = card.type.toLowerCase().includes('creature');
    const cmc = card.cmc;

    const row = isCreature ? 0 : 1;
    const col = Math.max(0, Math.min(7, Math.floor(cmc)));

    mainboard[row][col].push(index);
  }
  return mainboard;
};

export const formatSideboard = (decklist: Decklist, cardDetails: CardDetails[]) => {
  const sideboard: number[][][] = setupPicks(2, 8);

  for (const oracleId of decklist.side) {
    const index = upsertCardAndGetIndex(cardDetails, oracleId);
    const card = cardDetails[index];

    const cmc = card.cmc;

    const col = Math.max(0, Math.min(7, Math.floor(cmc)));

    sideboard[0][col].push(index);
  }
  return sideboard;
};

export const buildBotDeck = (
  pickorder: number[],
  basics: number[],
  cards: CardDetails[],
): { mainboard: number[][][]; sideboard: number[][][] } => {
  const mainboardBuilt = deckbuild(
    pickorder.map((index) => cards[index]),
    basics.map((index) => cards[index]),
  ).mainboard;

  const pool = pickorder.slice();

  const newMainboard = [];

  for (const oracle of mainboardBuilt) {
    const poolIndex = pool.findIndex((cardindex) => cards[cardindex].oracle_id === oracle);
    if (poolIndex === -1) {
      // try basics
      const basicsIndex = basics.findIndex((cardindex) => cards[cardindex].oracle_id === oracle);
      if (basicsIndex !== -1) {
        newMainboard.push(basics[basicsIndex]);
      }
    } else {
      newMainboard.push(pool[poolIndex]);
      pool.splice(poolIndex, 1);
    }
  }

  // format mainboard
  const formattedMainboard = setupPicks(2, 8);
  const formattedSideboard = setupPicks(1, 8);

  for (const index of newMainboard) {
    const card = cards[index];
    const { row, col } = getCardDefaultRowColumn(detailsToCard(card));

    formattedMainboard[row][col].push(index);
  }

  for (const index of pool) {
    if (!basics.includes(index)) {
      const card = cards[index];
      const { col } = getCardDefaultRowColumn(detailsToCard(card));

      formattedSideboard[0][col].push(index);
    }
  }

  return {
    mainboard: formattedMainboard,
    sideboard: formattedSideboard,
  };
};
