import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { cubeDao, draftDao, exportTaskDao } from '@server/dynamo/daos';
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import type DraftType from '@utils/datatypes/Draft';
import { getDrafterState } from '@utils/draftutil';
import fs from 'fs';

import { buildDraftKeySlices, draftKey, sliceHasKey } from './utils/draftKeySlices';
import { uploadFileToPublicBucket } from './utils/s3';

const draftCardIndexToOracle = (cardIndex: string | number, draftCards: { [x: string]: any }) => {
  const card = draftCards[cardIndex];
  if (!card) {
    return -1;
  }

  return card.details.oracle_id;
};

const draftCardIndexToOracleIndex = (cardIndex: any, draftCards: any, oracleToIndex: { [x: string]: any }) => {
  return oracleToIndex[draftCardIndexToOracle(cardIndex, draftCards)] ?? -1;
};

// Drafts store their date as a number or a Date depending on age; the export always writes epoch ms
// so training can keep only recent drafts.
const draftTimestamp = (date: Date | number | undefined): number | null => {
  if (date === undefined || date === null) return null;
  const value = typeof date === 'number' ? date : new Date(date).valueOf();
  return Number.isFinite(value) ? value : null;
};

const processDeck = (
  draft: { seats: any[]; id: any; cube: any; cards: any; basics: any; date?: Date | number },
  oracleToIndex: any,
) => {
  const seats: {
    id: any;
    cube: any;
    date: number | null;
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
        date: draftTimestamp(draft.date),
        owner: seat.owner.id,
        mainboard: seat.mainboard
          .flat(2)
          .map((pick: any) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex))
          .filter((index: number) => index !== -1),
        sideboard: seat.sideboard
          .flat(2)
          .map((pick: any) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex))
          .filter((index: number) => index !== -1),
        basics: (draft.basics || [])
          .map((pick: any) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex))
          .filter((index: number) => index !== -1),
      });
    }
  });

  return seats;
};

const processPicks = (
  draft: {
    id: any;
    date?: Date | number;
    seats: any[];
    InitialState: { [s: string]: unknown } | ArrayLike<unknown>;
    type: any;
    cards: any;
    cube: any;
  },
  oracleToIndex: any,
  landCapacity: number = 17,
  nonlandCapacity: number = 23,
) => {
  const picks: {
    draft: any;
    date: number | null;
    cube: any;
    cubeCards: number;
    owner: any;
    pack: any[];
    picked: any;
    pool: any[];
    landCount: number;
    nonlandCount: number;
  }[] = [];

  if (!draft.seats) {
    return { picks: [], cubeInstance: [] };
  }

  // Create cube instance - map all draft cards to oracle indexes
  const cubeInstance = Object.values(draft.cards || {})
    .map((card: any) => {
      const oracleId = card?.details?.oracle_id;
      return oracleToIndex[oracleId] ?? -1;
    })
    .filter((index: number) => index !== -1);

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
        const pack = drafterState.cardsInPack
          .map((pick: any) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex))
          .filter((index: number) => index !== -1);
        const pool = drafterState.picked
          .map((pick: any) => draftCardIndexToOracleIndex(pick, draft.cards, oracleToIndex))
          .filter((index: number) => index !== -1);

        const poolLands = drafterState.picked.filter((i: any) => {
          const c = draft.cards[i];
          return c && (c.type_line ?? c.details?.type ?? '').includes('Land');
        }).length;

        picks.push({
          draft: draft.id,
          date: draftTimestamp(draft.date),
          cube: draft.cube,
          cubeCards: 0,
          owner: seat.owner.id,
          pack,
          picked,
          pool,
          landCount: Math.min(1, poolLands / landCapacity),
          nonlandCount: Math.min(1, (pool.length - poolLands) / nonlandCapacity),
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

    // Drafts are read in date slices by a pool of workers. Each slice pages through complete drafts
    // only (incomplete ones are filtered out in DynamoDB), already loaded with their cards and seats,
    // so no draft is read twice. Batch files are numbered as they're written, not by date.
    const draftTypes = ['d', 'g', 's', 'u']; // Draft, Grid, Sealed, Upload
    const concurrency = Number(process.env.EXPORT_CONCURRENCY) || 8;
    const PAGE_SIZE = 500;
    const SLICE_MS = 30 * 24 * 60 * 60 * 1000;

    const EARLIEST = Date.UTC(2015, 0, 1); // before the first CubeCobra draft
    const slices = buildDraftKeySlices(draftTypes, EARLIEST, Date.now() + SLICE_MS, SLICE_MS);
    console.log(`${slices.length} slices across ${draftTypes.length} draft types, ${concurrency} at a time`);

    // Only these cube fields are used; one fetch per cube, shared by every worker.
    type CubeInfo = { visibility: string; deckbuildLands?: number; deckbuildSpells?: number };
    const cubeInfoCache = new Map<string, Promise<CubeInfo | null>>();
    const cubeInfo = (id: string): Promise<CubeInfo | null> => {
      let info = cubeInfoCache.get(id);
      if (!info) {
        info = cubeDao.getById(id).then((cube) =>
          cube
            ? {
                visibility: cube.visibility,
                deckbuildLands: cube.deckbuildLands,
                deckbuildSpells: cube.deckbuildSpells,
              }
            : null,
        );
        cubeInfoCache.set(id, info);
      }
      return info;
    };

    let nextBatch = 0;
    let exportedDrafts = 0;

    const exportPage = async (drafts: any[]): Promise<number> => {
      const cubes = await Promise.all(drafts.map((draft) => (draft.cube ? cubeInfo(draft.cube) : null)));
      // Only export drafts from public cubes
      const publicDrafts = drafts
        .map((draft, i) => ({ draft, cube: cubes[i] }))
        .filter(({ cube }) => cube?.visibility === CUBE_VISIBILITY.PUBLIC);
      if (publicDrafts.length === 0) return 0;

      const processedDrafts = publicDrafts.map(({ draft }) => processDeck(draft, oracleToIndex));
      const picksResults = publicDrafts.map(({ draft, cube }) =>
        processPicks(draft, oracleToIndex, cube?.deckbuildLands, cube?.deckbuildSpells),
      );

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

      const batch = nextBatch++;
      const files = [
        { key: `export/decks/${batch}.json`, data: processedDrafts.flat() },
        { key: `export/picks/${batch}.json`, data: batchPicks },
        { key: `export/cubeInstances/${batch}.json`, data: batchCubeInstances },
      ];
      for (const { key, data } of files) fs.writeFileSync(`./temp/${key}`, JSON.stringify(data));
      await Promise.all(files.map(({ key }) => uploadFileToPublicBucket(key, `./temp/${key}`)));
      for (const { key } of files) fs.unlinkSync(`./temp/${key}`);

      exportedDrafts += publicDrafts.length;
      return publicDrafts.length;
    };

    let nextSlice = 0;
    const worker = async () => {
      while (nextSlice < slices.length) {
        const index = nextSlice++;
        const slice = slices[index]!;
        let lastKey: Record<string, any> | undefined;
        let sliceDrafts = 0;
        do {
          const page = await draftDao.queryCompleteByTypeInDateKeyRange(
            slice.type,
            { from: slice.from, to: slice.to },
            lastKey,
            PAGE_SIZE,
          );
          lastKey = page.lastKey;
          const drafts = page.items.filter((draft) => sliceHasKey(slice, draftKey(draft.date)));
          sliceDrafts += await exportPage(drafts);
        } while (lastKey);
        const label = slice.from === undefined ? 'before 2015' : new Date(slice.from).toISOString().slice(0, 10);
        console.log(
          `Slice ${index + 1}/${slices.length} (type ${slice.type}, from ${label}): ` +
            `${sliceDrafts} drafts; ${exportedDrafts} exported in ${nextBatch} batches so far`,
        );
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));

    // Earlier exports may have written more batch files than this one; the manifest's count tells
    // readers which files belong to this export.
    const totalBatches = nextBatch;
    fs.writeFileSync('./temp/export/deckBatches.json', JSON.stringify({ count: totalBatches }));

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
