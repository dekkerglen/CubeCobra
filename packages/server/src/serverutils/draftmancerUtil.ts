import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import { DraftmancerPick } from '@utils/datatypes/Draft';
import { Decklist, Pick } from '@utils/datatypes/Draftmancer';
import { getCardDefaultRowColumn, setupPicks } from '@utils/draftutil';

import { getReasonableCardByOracle } from './carddb';
import { deckbuild } from './draftbots';

export const upsertCardAndGetIndex = (cards: CardDetails[], oracleId: string): number => {
  const card = getReasonableCardByOracle(oracleId);
  const index = cards.findIndex((c) => c.oracle_id === oracleId);

  if (index === -1) {
    cards.push(card);
    return cards.length - 1;
  }

  return index;
};

export const getPicksFromPlayer = (
  picks: Pick[],
  cardDetails: CardDetails[],
): {
  draftmancerPicks: DraftmancerPick[];
  pickorder: number[];
  trashorder: number[];
} => {
  const draftmancerPicks: DraftmancerPick[] = [];
  const pickorder: number[] = [];
  const trashorder: number[] = [];

  for (const pick of picks) {
    // we are going to ignore burned cards
    for (const index of pick.picks) {
      //As cards are matched from the Draftmancer data via Oracle ID, build up the card set in cards
      const pack: number[] = pick.booster.map((oracleId: string) => upsertCardAndGetIndex(cardDetails, oracleId));

      const pickIndex = pack[index];

      if (pickIndex !== undefined) {
        pickorder.push(pickIndex);
        draftmancerPicks.push({
          booster: pack,
          pick: pickIndex,
        });
      }
    }
  }

  return {
    draftmancerPicks,
    pickorder,
    trashorder,
  };
};

export const formatMainboard = (decklist: Decklist, cardDetails: CardDetails[]) => {
  const mainboard: number[][][] = setupPicks(2, 8);

  for (const oracleId of decklist.main) {
    const index = upsertCardAndGetIndex(cardDetails, oracleId);
    const card = cardDetails[index];

    if (!card) {
      continue;
    }

    //TODO: Consolidate with draftutil.getCardDefaultRowColumn
    const isCreature = card.type.toLowerCase().includes('creature');
    const cmc = card.cmc;

    const row = isCreature ? 0 : 1;
    const col = Math.max(0, Math.min(7, Math.floor(cmc)));

    if (mainboard[row]?.[col]) {
      mainboard[row][col].push(index);
    }
  }
  return mainboard;
};

export const formatSideboard = (decklist: Decklist, cardDetails: CardDetails[]) => {
  const sideboard: number[][][] = setupPicks(2, 8);

  for (const oracleId of decklist.side) {
    const index = upsertCardAndGetIndex(cardDetails, oracleId);
    const card = cardDetails[index];

    if (!card) {
      continue;
    }

    const cmc = card.cmc;

    const col = Math.max(0, Math.min(7, Math.floor(cmc)));

    if (sideboard[0]?.[col]) {
      sideboard[0][col].push(index);
    }
  }
  return sideboard;
};

export const buildBotDeck = async (
  pickorder: number[],
  basics: number[],
  cards: CardDetails[],
): Promise<{ mainboard: number[][][]; sideboard: number[][][] }> => {
  const mainboardBuilt = (
    await deckbuild(
      pickorder.map((index) => cards[index]).filter(Boolean),
      basics.map((index) => cards[index]).filter(Boolean),
    )
  ).mainboard;

  const pool = pickorder.slice();

  const newMainboard = [];

  for (const oracle of mainboardBuilt) {
    const poolIndex = pool.findIndex((cardindex) => cards[cardindex]?.oracle_id === oracle);
    if (poolIndex === -1) {
      // try basics
      const basicsIndex = basics.findIndex((cardindex) => cards[cardindex]?.oracle_id === oracle);
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
    if (typeof index !== 'number') {
      continue;
    }
    const card = cards[index];
    if (!card) {
      continue;
    }
    const { row, col } = getCardDefaultRowColumn(detailsToCard(card));

    if (formattedMainboard[row]?.[col]) {
      formattedMainboard[row][col].push(index);
    }
  }

  for (const index of pool) {
    if (!basics.includes(index)) {
      const card = cards[index];
      if (!card) {
        continue;
      }
      const { col } = getCardDefaultRowColumn(detailsToCard(card));

      if (formattedSideboard[0]?.[col]) {
        formattedSideboard[0][col].push(index);
      }
    }
  }

  return {
    mainboard: formattedMainboard,
    sideboard: formattedSideboard,
  };
};
