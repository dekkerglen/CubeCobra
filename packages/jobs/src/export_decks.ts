import dotenv from 'dotenv';
dotenv.config({ path: require('path').join(__dirname, '..', '..', '.env') });
import Draft from '@server/dynamo/models/draft';
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import type DraftType from '@utils/datatypes/Draft';
import { getDrafterState } from '@utils/draftutil';
import fs from 'fs';
import path from 'path';

import 'module-alias/register';

const draftCardIndexToOracle = (cardIndex: string | number, draftCards: { [x: string]: any }) => {
  const card = draftCards[cardIndex];
  if (!card) {
    return -1;
  }

  return card.details.oracle_id;
};

const draftCardIndexToOracleIndex = (cardIndex: any, draftCards: any, oracleToIndex: { [x: string]: any }) => {
  return oracleToIndex[draftCardIndexToOracle(cardIndex, draftCards)] || -1;
};

const processDeck = (draft: { seats: any[]; id: any; cube: any; cards: any; basics: any }, oracleToIndex: any) => {
  const seats: {
    id: any;
    cube: any;
    owner: any;
    mainboard: number[];
    sideboard: number[];
    basics: number[];
  }[] = [];

  if (!draft.seats) {
    return [];
  }

  draft.seats.forEach((seat: { owner: { id: any }; mainboard: any[]; sideboard: any[] }) => {
    if (seat.owner) {
      seats.push({
        id: draft.id,
        cube: draft.cube,
        owner: seat.owner.id,
        mainboard: seat.mainboard
          .flat(2)
          .map((pick: any) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex)),
        sideboard: seat.sideboard
          .flat(2)
          .map((pick: any) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex)),
        basics: (draft.basics || []).map((pick: any) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex)),
      });
    }
  });

  return seats;
};

const processPicks = (
  draft: {
    seats: any[];
    InitialState: { [s: string]: unknown } | ArrayLike<unknown>;
    type: any;
    cards: any;
    cube: any;
  },
  oracleToIndex: any,
) => {
  const picks: {
    cube: any;
    owner: any;
    pack: any[];
    picked: any;
    pool: any[];
  }[] = [];

  if (!draft.seats) {
    return [];
  }

  draft.seats.forEach((seat: { pickorder: any; owner: { id: any } }) => {
    if (
      draft.InitialState &&
      Object.entries(draft.InitialState).length > 0 &&
      seat.pickorder &&
      draft.type === Draft.TYPES.DRAFT &&
      seat.owner
    ) {
      for (let j = 0; j < draft.seats[0].pickorder.length; j++) {
        const drafterState = getDrafterState(draft as any as DraftType, 0, j);

        const picked = draftCardIndexToOracleIndex(drafterState.selection, draft.cards, oracleToIndex);
        const pack = drafterState.cardsInPack.map((pick: any) =>
          draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex),
        );
        const pool = drafterState.picked.map((pick: any) =>
          draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex),
        );

        picks.push({
          cube: draft.cube,
          owner: seat.owner.id,
          pack,
          picked,
          pool,
        });
      }
    }
  });

  return picks;
};

(async () => {
  const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
  await initializeCardDb(privateDir);

  const indexToOracleMap = JSON.parse(fs.readFileSync('./temp/export/indexToOracleMap.json', 'utf8'));
  const oracleToIndex = Object.fromEntries(
    Object.entries(indexToOracleMap).map(([index, oracle]) => [oracle, parseInt(index, 10)]),
  );

  // load all draftlogs into memory
  let lastKey: any = null;
  let draftLogs: any[] = [];
  do {
    const result = await Draft.scan(1000000, lastKey);
    draftLogs = draftLogs.concat(result.items);
    lastKey = result.lastKey;

    console.log(`Loaded ${draftLogs.length} draftlogs`);
  } while (lastKey);

  console.log('Loaded all draftlogs');

  const batches: any[] = [];

  for (let i = 0; i < draftLogs.length; i += 1000) {
    batches.push(draftLogs.slice(i, i + 1000));
  }

  if (!fs.existsSync('./temp/export/decks')) {
    fs.mkdirSync('./temp/export/decks');
  }
  if (!fs.existsSync('./temp/export/picks')) {
    fs.mkdirSync('./temp/export/picks');
  }

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];

    const drafts = await Draft.batchGet(
      batch.filter((item: { complete: any }) => item.complete).map((row: { id: any }) => row.id),
    );

    const processedDrafts = drafts.map((draft: any) => processDeck(draft, oracleToIndex));
    const processedPicks = drafts.map((draft: any) => processPicks(draft, oracleToIndex));

    fs.writeFileSync(`./temp/export/decks/${i}.json`, JSON.stringify(processedDrafts.flat()));
    fs.writeFileSync(`./temp/export/picks/${i}.json`, JSON.stringify(processedPicks.flat()));

    console.log(`Processed ${i + 1} / ${batches.length} batches`);
  }
})();
