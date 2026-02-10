import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { draftDao, exportTaskDao } from '@server/dynamo/daos';
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import type DraftType from '@utils/datatypes/Draft';
import { getDrafterState } from '@utils/draftutil';
import fs from 'fs';

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
    cubeCards: number;
    owner: any;
    pack: any[];
    picked: any;
    pool: any[];
  }[] = [];

  if (!draft.seats) {
    return { picks: [], cubeInstance: [] };
  }

  // Create cube instance - map all draft cards to oracle indexes
  const cubeInstance = Object.values(draft.cards || {}).map((card: any) => {
    const oracleId = card?.details?.oracle_id;
    return oracleToIndex[oracleId] || -1;
  });

  draft.seats.forEach((seat: { pickorder: any; owner: { id: any } }) => {
    if (
      draft.InitialState &&
      Object.entries(draft.InitialState).length > 0 &&
      seat.pickorder &&
      draft.type === 'd' &&
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
          cubeCards: 0,
          owner: seat.owner.id,
          pack,
          picked,
          pool,
        });
      }
    }
  });

  return { picks, cubeInstance };
};

const taskId = process.env.EXPORT_TASK_ID;

(async () => {
  try {
    if (taskId) {
      await exportTaskDao.updateStep(taskId, 'Initializing');
    }

    const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
    await initializeCardDb(privateDir);

    const indexToOracleMap = JSON.parse(fs.readFileSync('./temp/export/indexToOracleMap.json', 'utf8'));
    const oracleToIndex = Object.fromEntries(
      Object.entries(indexToOracleMap).map(([index, oracle]) => [oracle, parseInt(index, 10)]),
    );

    if (!fs.existsSync('./temp/export/decks')) {
      fs.mkdirSync('./temp/export/decks');
    }
    if (!fs.existsSync('./temp/export/picks')) {
      fs.mkdirSync('./temp/export/picks');
    }
    if (!fs.existsSync('./temp/export/cubeInstances')) {
      fs.mkdirSync('./temp/export/cubeInstances');
    }

    if (taskId) {
      await exportTaskDao.updateStep(taskId, 'Processing drafts');
    }

    console.log('Starting draft export...');

    // Query all draft types to get all drafts
    const draftTypes = ['d', 'g', 's', 'u']; // Draft, Grid, Sealed, Upload

    let totalBatches = 0;
    const BATCH_SIZE = 500; // Process 500 drafts at a time to reduce memory usage

    for (const draftType of draftTypes) {
      console.log(`Processing draft type: ${draftType}`);
      let typeLastKey: any = null;
      let draftLogBatch: any[] = [];
      let totalProcessed = 0;

      do {
        // Load a page of draft metadata
        const result = await draftDao.queryByTypeAndDate(draftType, typeLastKey);
        draftLogBatch = draftLogBatch.concat(result.items);
        typeLastKey = result.lastKey;

        // Process batches when we have enough, or when we're done with this type
        while (draftLogBatch.length >= BATCH_SIZE || (!typeLastKey && draftLogBatch.length > 0)) {
          const batchToProcess = draftLogBatch.splice(0, BATCH_SIZE);

          const draftIds = batchToProcess
            .filter((item: { complete: any }) => item.complete)
            .map((row: { id: any }) => row.id);
          const drafts = await Promise.all(draftIds.map((id: string) => draftDao.getById(id)));
          const validDrafts = drafts.filter((d): d is NonNullable<typeof d> => d !== null);

          const processedDrafts = validDrafts.map((draft: any) => processDeck(draft, oracleToIndex));
          const picksResults = validDrafts.map((draft: any) => processPicks(draft, oracleToIndex));

          // Collect cube instances and picks for this batch
          const batchCubeInstances: number[][] = [];
          const batchPicks = picksResults.flatMap((result) => {
            // Add this cube instance to the batch array
            const batchIndex = batchCubeInstances.length;
            batchCubeInstances.push(result.cubeInstance);

            // Update all picks to reference the batch cube instance index
            result.picks.forEach((pick) => {
              pick.cubeCards = batchIndex;
            });

            return result.picks;
          });

          fs.writeFileSync(`./temp/export/decks/${totalBatches}.json`, JSON.stringify(processedDrafts.flat()));
          fs.writeFileSync(`./temp/export/picks/${totalBatches}.json`, JSON.stringify(batchPicks));
          fs.writeFileSync(`./temp/export/cubeInstances/${totalBatches}.json`, JSON.stringify(batchCubeInstances));

          totalBatches += 1;
          totalProcessed += batchToProcess.length;

          console.log(
            `Processed batch ${totalBatches} (${totalProcessed} drafts from type ${draftType}, ${validDrafts.length} complete drafts in this batch)`,
          );

          // Don't loop again if we don't have enough for another batch and we're done loading
          if (!typeLastKey && draftLogBatch.length < BATCH_SIZE) {
            break;
          }
        }
      } while (typeLastKey);
    }

    console.log(`Export complete! Processed ${totalBatches} total batches.`);
    process.exit(0);
  } catch (error) {
    console.error('Export failed:', error);
    if (taskId) {
      await exportTaskDao.markAsFailed(
        taskId,
        error instanceof Error ? error.message : 'Unknown error during deck export',
      );
    }
    process.exit(1);
  }
})();
