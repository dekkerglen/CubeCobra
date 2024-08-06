require('dotenv').config();

const fs = require('fs');
const carddb = require('../serverjs/carddb');

const { getDrafterState } = require('../dist/drafting/draftutil');
const Draft = require('../dynamo/models/draft');

const draftCardIndexToOracle = (cardIndex, draftCards) => {
  const card = draftCards[cardIndex];
  if (!card) {
    return -1;
  }

  return card.details.oracle_id;
};

const draftCardIndexToOracleIndex = (cardIndex, draftCards, oracleToIndex) => {
  return oracleToIndex[draftCardIndexToOracle(cardIndex, draftCards)] || -1;
};

const processDeck = (draft, oracleToIndex) => {
  const seats = [];

  if (!draft.seats) {
    return [];
  }

  draft.seats.forEach((seat) => {
    if (seat.owner) {
      seats.push({
        id: draft.id,
        cube: draft.cube,
        owner: seat.owner.id,
        mainboard: seat.mainboard.flat(2).map((pick) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex)),
        sideboard: seat.sideboard.flat(2).map((pick) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex)),
        basics: (draft.basics || []).map((pick) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex)),
      });
    }
  });

  return seats;
};

const processPicks = (draft, oracleToIndex) => {
  const picks = [];

  if (!draft.seats) {
    return [];
  }

  draft.seats.forEach((seat) => {
    if (
      draft.InitialState &&
      Object.entries(draft.InitialState).length > 0 &&
      seat.pickorder &&
      draft.type === Draft.TYPES.DRAFT &&
      seat.owner
    ) {
      for (let j = 0; j < draft.seats[0].pickorder.length; j++) {
        const drafterState = getDrafterState(draft, 0, j);

        const picked = draftCardIndexToOracleIndex(drafterState.selection, draft.cards, oracleToIndex);
        const pack = drafterState.cardsInPack.map((pick) =>
          draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex),
        );
        const pool = drafterState.picked.map((pick) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex));

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
  await carddb.initializeCardDb();

  const indexToOracleMap = JSON.parse(fs.readFileSync('./temp/export/indexToOracleMap.json', 'utf8'));
  const oracleToIndex = Object.fromEntries(
    Object.entries(indexToOracleMap).map(([index, oracle]) => [oracle, parseInt(index, 10)]),
  );

  // load all draftlogs into memory
  let lastKey = null;
  let draftLogs = [];
  do {
    const result = await Draft.scan(1000000, lastKey);
    draftLogs = draftLogs.concat(result.items);
    lastKey = result.lastKey;

    console.log(`Loaded ${draftLogs.length} draftlogs`);
  } while (lastKey);

  console.log('Loaded all draftlogs');

  const batches = [];

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

    const drafts = await Draft.batchGet(batch.filter((item) => item.complete).map((row) => row.id));

    const processedDrafts = drafts.map((draft) => processDeck(draft, oracleToIndex));
    const processedPicks = drafts.map((draft) => processPicks(draft, oracleToIndex));

    fs.writeFileSync(`./temp/export/decks/${i}.json`, JSON.stringify(processedDrafts.flat()));
    fs.writeFileSync(`./temp/export/picks/${i}.json`, JSON.stringify(processedPicks.flat()));

    console.log(`Processed ${i + 1} / ${batches.length} batches`);
  }
})();
