// Load Environment Variables
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
// Configure dotenv with explicit path to jobs package .env
dotenv.config({ path: path.resolve(process.cwd(), 'packages', 'jobs', '.env') });

import { cardHistoryDao, cardUpdateTaskDao, changelogDao } from '@server/dynamo/daos';
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import { cardFromId } from '@server/serverutils/carddb';
import { getCubeTypes } from '@server/serverutils/cubefn';
import { initializeMl } from '@server/serverutils/ml';
import { DefaultElo } from '@utils/datatypes/Card';
import type ChangeLogType from '@utils/datatypes/ChangeLog';
import History, { Period } from '@utils/datatypes/History';
import fs from 'fs';

import { downloadJson, listFiles, uploadJson } from './utils/s3';

const { encode } = require('@server/serverutils/ml');
type CubeDict = Record<string, string[]>;

const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
const taskId = process.env.CARD_UPDATE_TASK_ID;

interface CubeHistory {
  cubes: Record<string, number[]>;
  indexToOracleMap: Record<number, string>;
}

interface Totals {
  size180: number;
  size360: number;
  size450: number;
  size540: number;
  size720: number;
  pauper: number;
  peasant: number;
  legacy: number;
  modern: number;
  vintage: number;
  pioneer: number;
  total: number;
}

const saveCubesHistory = async (cubes: CubeDict, key: string) => {
  const uniqueOracles = [...new Set(Object.values(cubes).flat())];

  const oracleToIndexMap = Object.fromEntries(uniqueOracles.map((oracle, index) => [oracle, index]));
  const indexToOracleMap = Object.fromEntries(uniqueOracles.map((oracle, index) => [index, oracle]));

  const cubeHistory: CubeHistory = {
    cubes: {},
    indexToOracleMap,
  };

  for (const [cubeId, cube] of Object.entries(cubes)) {
    cubeHistory.cubes[cubeId] = cube
      .map((card) => oracleToIndexMap[card])
      .filter((index): index is number => index !== undefined);
  }

  await uploadJson(`cubes_history/${key}.json`, cubeHistory);
};

const loadCubesHistory = async (key: string): Promise<CubeDict> => {
  const data: CubeHistory | null = await downloadJson(`cubes_history/${key}.json`);

  if (!data) {
    return {};
  }

  const cubes: CubeDict = {};
  for (const [cubeId, cube] of Object.entries(data.cubes)) {
    cubes[cubeId] = cube
      .map((index) => data.indexToOracleMap[index])
      .filter((oracle): oracle is string => oracle !== undefined);
  }

  return cubes;
};

const mapTotalsToCardHistory = (
  oracle: string,
  type: Period,
  history: Totals,
  totals: Totals,
  date: number,
  elo: number,
): History => {
  return {
    OTComp: `${oracle}:${type}`,
    oracle,
    date,
    picks: 0,
    size180: [history.size180, totals.size180],
    size360: [history.size360, totals.size360],
    size450: [history.size450, totals.size450],
    size540: [history.size540, totals.size540],
    size720: [history.size720, totals.size720],
    pauper: [history.pauper, totals.pauper],
    peasant: [history.peasant, totals.peasant],
    legacy: [history.legacy, totals.legacy],
    modern: [history.modern, totals.modern],
    vintage: [history.vintage, totals.vintage],
    total: [history.total, totals.total],
    cubeCount: [history.total, totals.total],
    elo: elo || DefaultElo,
    cubes: history.total,
    dateCreated: date,
    dateLastUpdated: date,
  };
};

(async () => {
  if (taskId) {
    await cardUpdateTaskDao.updateStep(taskId, 'Processing Cube History');
  }

  console.log('Loading card database');
  await initializeCardDb(privateDir);

  console.log('Initializing ML models');
  const rootDir = path.join(__dirname, '..', '..', 'server');
  await initializeMl(rootDir);

  // List existing files in S3 cubes_history to determine which days are already processed
  // We only check filenames, not file contents, since files are large
  const existingFiles = await listFiles('cubes_history/');
  const processedDays = new Set(
    existingFiles
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.split('/').pop()?.replace('.json', ''))
      .filter((f): f is string => f !== undefined),
  );

  console.log(`Found ${processedDays.size} already processed days`);

  // Determine the date range - start from earliest processed day or default start date
  let firstDate: Date;

  if (processedDays.size > 0) {
    // Parse filenames to find the earliest date
    const existingDates = Array.from(processedDays).map((key) => {
      const [year, month, day] = key.split('-').map((x) => parseInt(x, 10));
      // Keys use 1-indexed months (01-12), Date constructor expects 0-indexed (0-11)
      return new Date(year ?? 0, (month ?? 1) - 1, day ?? 0);
    });
    firstDate = new Date(Math.min(...existingDates.map((d) => d.valueOf())));
  } else {
    // If no processed days, start from a reasonable date (e.g., 2020-01-01)
    firstDate = new Date(2020, 0, 1);
  }

  const today = new Date();

  // Generate all date keys from firstDate to today
  const allKeys: string[] = [];
  for (let i = firstDate.valueOf(); i <= today.valueOf(); i += 86400000) {
    const date = new Date(i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    allKeys.push(key);
  }

  // Filter to only keys that haven't been processed yet
  const keys = allKeys.filter((key) => !processedDays.has(key));

  console.log(
    `Processing date range from ${firstDate.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`,
  );
  console.log(`${keys.length} days need processing (${processedDays.size} already complete)`);

  // sort the keys ascending
  keys.sort((a, b) => {
    const [yearA, monthA, dayA] = a.split('-').map((x) => parseInt(x, 10));
    const [yearB, monthB, dayB] = b.split('-').map((x) => parseInt(x, 10));

    // Handle potential undefined values by treating them as 0
    const safeYearA = yearA ?? 0;
    const safeYearB = yearB ?? 0;
    const safeMonthA = monthA ?? 0;
    const safeMonthB = monthB ?? 0;
    const safeDayA = dayA ?? 0;
    const safeDayB = dayB ?? 0;

    if (safeYearA !== safeYearB) {
      return safeYearA - safeYearB;
    }

    if (safeMonthA !== safeMonthB) {
      return safeMonthA - safeMonthB;
    }

    return safeDayA - safeDayB;
  });

  console.log(`${keys.length} days need processing (${processedDays.size} already complete)`);

  let cubes: CubeDict = {};
  let oracleToElo: Record<string, number> = {};

  // If we have processed days, load the most recent one to get current cube state
  if (processedDays.size > 0 && keys.length > 0) {
    // Find the most recent processed day before our first unprocessed day
    const firstUnprocessedKey = keys[0];
    const [firstYear, firstMonth, firstDay] = firstUnprocessedKey!.split('-').map((x) => parseInt(x, 10));
    // Keys are in format YYYY-MM-DD where MM is 1-indexed, so subtract 1 for Date constructor
    const firstUnprocessedDate = new Date(firstYear ?? 0, (firstMonth ?? 1) - 1, firstDay ?? 0).valueOf();

    const previousProcessedKeys = Array.from(processedDays)
      .map((key) => {
        const [year, month, day] = key.split('-').map((x) => parseInt(x, 10));
        return {
          key,
          // Keys use 1-indexed months, Date constructor expects 0-indexed
          date: new Date(year ?? 0, (month ?? 1) - 1, day ?? 0).valueOf(),
        };
      })
      .filter((item) => item.date < firstUnprocessedDate)
      .sort((a, b) => b.date - a.date);

    if (previousProcessedKeys.length > 0) {
      const mostRecentKey = previousProcessedKeys[0]?.key;
      if (mostRecentKey) {
        console.log(`Loading cube state from most recent processed day: ${mostRecentKey}`);
        cubes = await loadCubesHistory(mostRecentKey);
      }
    }
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (!key) continue; // Skip undefined keys

    // Parse the key to get year, month, day
    const [year, month, day] = key.split('-').map((x) => parseInt(x, 10));

    if (!year || month === undefined || !day) {
      console.error(`Invalid date format for key: ${key}`);
      continue;
    }

    // Query changelogs for this specific day using the new GSI2 query method
    console.log(`Loading changelogs for ${key}...`);
    let dayChangelogs: ChangeLogType[] = [];
    let lastKey: Record<string, any> | undefined;

    do {
      // Key format is YYYY-MM-DD with 1-indexed month, DAO expects 1-indexed month
      const result = await changelogDao.queryByDay(year, month, day, lastKey);
      dayChangelogs = dayChangelogs.concat(result.items);
      lastKey = result.lastKey;
    } while (lastKey);

    console.log(`Loaded ${dayChangelogs.length} changelogs for ${key}`);

    // Process changelogs in batches to avoid overwhelming batchGet
    const CHANGELOG_BATCH_SIZE = 500;
    for (let batchStart = 0; batchStart < dayChangelogs.length; batchStart += CHANGELOG_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + CHANGELOG_BATCH_SIZE, dayChangelogs.length);
      const changelogBatch = dayChangelogs.slice(batchStart, batchEnd);

      // Batch get the changelog data from S3
      const logRows = changelogBatch.map((cl) => ({ cube: cl.cube, id: cl.id }));
      const logs = await changelogDao.batchGet(logRows);

      // Apply changelog changes to cube state
      for (let j = 0; j < logs.length; j++) {
        const log = logs[j];
        const changelog = changelogBatch[j];

        if (!log || !changelog) continue; // Skip undefined logs or changelogs

        if (!cubes[changelog.cube]) {
          cubes[changelog.cube] = [];
        }

        if (log.mainboard && log.mainboard.adds) {
          for (const add of log.mainboard.adds) {
            cubes[changelog.cube]?.push(add.cardID);
          }
        }

        if (log.mainboard && log.mainboard.removes) {
          for (const remove of log.mainboard.removes) {
            const cubeArray = cubes[changelog.cube];
            if (cubeArray) {
              cubeArray.splice(cubeArray.indexOf(remove.oldCard.cardID), 1);
            }
          }
        }

        if (log.mainboard && log.mainboard.swaps) {
          for (const swap of log.mainboard.swaps) {
            const cubeArray = cubes[changelog.cube];
            if (cubeArray) {
              cubeArray.splice(cubeArray.indexOf(swap.oldCard.cardID), 1, swap.card.cardID);
            }
          }
        }
      }

      if (batchStart + CHANGELOG_BATCH_SIZE < dayChangelogs.length) {
        console.log(`  Processed ${batchEnd} / ${dayChangelogs.length} changelogs...`);
      }
    }

    console.log(`  Saving cube state snapshot to temp/cubes_history/${key}.json...`);
    await saveCubesHistory(cubes, key);
    console.log(`  Saved ${Object.keys(cubes).length} cubes to history file`);

    // Allow connection pool to recover after processing changelogs
    console.log(`  Waiting 5 seconds for connection pool to settle...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const totals: Totals = {
      size180: 0,
      size360: 0,
      size450: 0,
      size540: 0,
      size720: 0,
      pauper: 0,
      peasant: 0,
      legacy: 0,
      modern: 0,
      vintage: 0,
      pioneer: 0,
      total: 0,
    };

    const data: Record<string, Totals> = {};

    console.log(`  Calculating card statistics for ${Object.keys(cubes).length} cubes...`);
    let processedCubes = 0;
    const totalCubes = Object.values(cubes).length;
    for (const cube of Object.values(cubes)) {
      processedCubes += 1;
      if (processedCubes % 5000 === 0) {
        console.log(`    Analyzed ${processedCubes} / ${totalCubes} cubes...`);
      }
      const cubeCards = cube.map((id) => cardFromId(id));
      const oracles = [...new Set(cubeCards.map((card) => card.oracle_id))];
      const { pauper, peasant, type } = getCubeTypes(
        cubeCards.map((card) => ({
          cardID: card.scryfall_id,
          status: 'Not Owned',
          cmc: card.cmc || 0,
          tags: [],
          colors: card.colors || [],
        })),
      );

      const size = cube.length;

      const categories: [keyof Totals] = ['total'];

      if (size <= 180) {
        categories.push('size180');
      } else if (size <= 360) {
        categories.push('size360');
      } else if (size <= 450) {
        categories.push('size450');
      } else if (size <= 540) {
        categories.push('size540');
      } else {
        categories.push('size720');
      }

      if (pauper) {
        categories.push('pauper');
      }

      if (peasant) {
        categories.push('peasant');
      }

      switch (type) {
        case 0: // vintage
          categories.push('vintage');
          break;
        case 1: // legacy
          categories.push('legacy');
          break;
        case 2: // modern
          categories.push('modern');
          break;
        case 4: // pioneer
          categories.push('pioneer');
          break;
        default:
          break;
      }

      for (const category of categories) {
        totals[category] += 1;
      }

      for (const oracle of oracles) {
        if (!data[oracle]) {
          data[oracle] = {
            total: 0,
            size180: 0,
            size360: 0,
            size450: 0,
            size540: 0,
            size720: 0,
            pauper: 0,
            peasant: 0,
            legacy: 0,
            modern: 0,
            pioneer: 0,
            vintage: 0,
          };
        }

        for (const category of categories) {
          data[oracle][category] += 1;
        }
      }
    }
    console.log(`  Completed analysis: found ${Object.keys(data).length} unique cards across all cubes`);

    const eloFile = await downloadJson(`global_draft_history/${key}.json`);
    if (eloFile) {
      console.log(`  Loading ELO data from S3 global_draft_history/${key}.json...`);
      oracleToElo = eloFile.eloByOracleId;
      console.log(`  Loaded ELO data for ${Object.keys(oracleToElo).length} cards`);
    }

    const date = new Date(year, month - 1, day).valueOf();

    // Write card history in smaller batches with delays to avoid overwhelming connection pool
    const WRITE_BATCH_SIZE = 200; // Process 200 cards at a time to avoid connection pool issues
    const WRITE_DELAY_MS = 250; // 250ms delay between DynamoDB batches (of 25 items)

    // Process and write entries in chunks instead of materializing all at once
    const dataEntries = Object.entries(data);
    console.log(`  Writing ${dataEntries.length} daily history entries...`);
    for (let i = 0; i < dataEntries.length; i += WRITE_BATCH_SIZE) {
      const chunk = dataEntries.slice(i, i + WRITE_BATCH_SIZE);
      const historyEntries = chunk.map(([oracle, history]) =>
        mapTotalsToCardHistory(oracle, Period.DAY, history, totals, date, oracleToElo[oracle] ?? 0),
      );
      await cardHistoryDao.batchPut(historyEntries, WRITE_DELAY_MS);
      console.log(`    Written ${Math.min(i + WRITE_BATCH_SIZE, dataEntries.length)} / ${dataEntries.length}...`);
    }

    // if key is a sunday
    const dateObj = new Date(year, month - 1, day);
    if (dateObj.getDay() === 0) {
      console.log(`  Writing ${dataEntries.length} weekly history entries...`);
      for (let i = 0; i < dataEntries.length; i += WRITE_BATCH_SIZE) {
        const chunk = dataEntries.slice(i, i + WRITE_BATCH_SIZE);
        const historyEntries = chunk.map(([oracle, history]) =>
          mapTotalsToCardHistory(oracle, Period.WEEK, history, totals, date, oracleToElo[oracle] ?? 0),
        );
        await cardHistoryDao.batchPut(historyEntries, WRITE_DELAY_MS);
        console.log(`    Written ${Math.min(i + WRITE_BATCH_SIZE, dataEntries.length)} / ${dataEntries.length}...`);
      }
    }

    // if key is first of the month
    if (dateObj.getDate() === 1) {
      console.log(`  Writing ${dataEntries.length} monthly history entries...`);
      for (let i = 0; i < dataEntries.length; i += WRITE_BATCH_SIZE) {
        const chunk = dataEntries.slice(i, i + WRITE_BATCH_SIZE);
        const historyEntries = chunk.map(([oracle, history]) =>
          mapTotalsToCardHistory(oracle, Period.MONTH, history, totals, date, oracleToElo[oracle] ?? 0),
        );
        await cardHistoryDao.batchPut(historyEntries, WRITE_DELAY_MS);
        console.log(`    Written ${Math.min(i + WRITE_BATCH_SIZE, dataEntries.length)} / ${dataEntries.length}...`);
      }
    }

    console.log(`Finished ${i + 1} / ${keys.length}: Processed ${dayChangelogs.length} logs for ${key}`);
  }

  // Generate cube embeddings
  console.log('Generating cube embeddings...');
  if (taskId) {
    await cardUpdateTaskDao.updateStep(taskId, 'Generating Cube Embeddings');
  }

  const cubeEmbeddings: Record<string, number[]> = {};
  const cubeIds = Object.keys(cubes);
  console.log(`Processing ${cubeIds.length} cubes for embeddings...`);

  for (let i = 0; i < cubeIds.length; i++) {
    const cubeId = cubeIds[i];
    if (!cubeId) continue;

    const cubeOracles = cubes[cubeId];

    if (!cubeOracles || cubeOracles.length === 0) {
      continue; // Skip empty cubes
    }

    // Generate embedding for this cube using the ML encoder
    const embedding = encode(cubeOracles);

    if (embedding && embedding.length > 0) {
      cubeEmbeddings[cubeId] = Array.from(embedding);
    }

    if (i % 1000 === 0 && i > 0) {
      console.log(`  Processed ${i} / ${cubeIds.length} cubes...`);
    }
  }

  console.log(`Generated embeddings for ${Object.keys(cubeEmbeddings).length} cubes`);

  // Save cube embeddings to file
  const cubeEmbeddingsPath = path.join(privateDir, 'cubeEmbeddings.json');
  console.log(`Saving cube embeddings to ${cubeEmbeddingsPath}...`);
  fs.writeFileSync(cubeEmbeddingsPath, JSON.stringify(cubeEmbeddings));
  console.log('Cube embeddings saved to file');

  if (taskId) {
    await cardUpdateTaskDao.updateStep(taskId, 'Finished Cube History Processing');
  }

  console.log('Complete');

  process.exit();
})();
