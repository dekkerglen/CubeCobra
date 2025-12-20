import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
// Configure dotenv with explicit path to jobs package .env
dotenv.config({ path: path.resolve(process.cwd(), 'packages', 'jobs', '.env') });

import { cubeDao, draftDao } from '@server/dynamo/daos';
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import { DefaultElo } from '@utils/datatypes/Card';
import type { CardAnalytic } from '@utils/datatypes/CubeAnalytic';
import type DraftType from '@utils/datatypes/Draft';
import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { getDrafterState } from '@utils/draftutil';
import EloRating from 'elo-rating';
import fs from 'fs';

// global listeners for promise rejections
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise ', p, ' reason: ', reason);
});

const ELO_SPEED = 0.1;
const CUBE_ELO_SPEED = 2;
const privateDir = '../server/private/';

const adjustElo = (winnerElo: number, loserElo: number, speed: number): [number, number] => {
  const { playerRating, opponentRating } = EloRating.calculate(winnerElo, loserElo, true);

  const winnerEloChange = (playerRating - winnerElo) * speed;
  const loserEloChange = (opponentRating - loserElo) * speed;

  return [winnerEloChange, loserEloChange];
};

const incrementDict = (dict: { [x: string]: number }, key: string) => {
  if (!dict[key]) {
    dict[key] = 0;
  }

  dict[key] += 1;
};

const loadAndProcessCubeDraftAnalytics = (cube: string) => {
  const source = JSON.parse(fs.readFileSync(`./temp/cube_draft_history/${cube}`, 'utf-8')) as {
    eloByCubeAndOracleId: Record<string, number>;
    picksByCubeAndOracleId: Record<string, number>;
    passesByCubeAndOracleId: Record<string, number>;
    mainboardsByCubeAndOracleId: Record<string, number>;
    sideboardsByCubeAndOracleId: Record<string, number>;
  };

  const cubeAnalytics: Record<string, Partial<CardAnalytic>> = {};

  for (const [key, value] of Object.entries(source.eloByCubeAndOracleId)) {
    cubeAnalytics[key] = {
      elo: value,
    };
  }

  for (const [key, value] of Object.entries(source.picksByCubeAndOracleId)) {
    if (!cubeAnalytics[key]) {
      cubeAnalytics[key] = {};
    }

    cubeAnalytics[key].picks = value;
  }

  for (const [key, value] of Object.entries(source.passesByCubeAndOracleId)) {
    if (!cubeAnalytics[key]) {
      cubeAnalytics[key] = {};
    }

    cubeAnalytics[key].passes = value;
  }

  for (const [key, value] of Object.entries(source.mainboardsByCubeAndOracleId)) {
    if (!cubeAnalytics[key]) {
      cubeAnalytics[key] = {};
    }

    cubeAnalytics[key].mainboards = value;
  }

  for (const [key, value] of Object.entries(source.sideboardsByCubeAndOracleId)) {
    if (!cubeAnalytics[key]) {
      cubeAnalytics[key] = {};
    }

    cubeAnalytics[key].sideboards = value;
  }

  return cubeAnalytics;
};

(async () => {
  // create temp folder
  if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp');
  }
  // create global_draft_history and cube_draft_history folders
  if (!fs.existsSync('./temp/global_draft_history')) {
    fs.mkdirSync('./temp/global_draft_history');
  }
  if (!fs.existsSync('./temp/cube_draft_history')) {
    fs.mkdirSync('./temp/cube_draft_history');
  }
  if (!fs.existsSync('./temp/all_drafts')) {
    fs.mkdirSync('./temp/all_drafts');
  }
  if (!fs.existsSync('./temp/drafts_by_day')) {
    fs.mkdirSync('./temp/drafts_by_day');
  }

  await initializeCardDb(privateDir);

  // List existing files in drafts_by_day to determine which days are already processed
  const existingFiles = fs.existsSync('./temp/drafts_by_day')
    ? fs.readdirSync('./temp/drafts_by_day').filter((f) => f.endsWith('.json'))
    : [];

  const processedDays = new Set(existingFiles.map((f) => f.replace('.json', '')));

  console.log(`Found ${processedDays.size} already processed days`);

  // CubeCobra draft data starts from June 15, 2019
  const dataStartDate = new Date(2019, 5, 15);

  // Determine the date range - start from earliest processed day or default start date
  let firstDate: Date;

  if (processedDays.size > 0) {
    // Parse filenames to find the earliest date
    const existingDates = Array.from(processedDays).map((key) => {
      const [year, month, day] = key.split('-').map((x) => parseInt(x, 10));
      return new Date(year ?? 0, month ?? 0, day ?? 0);
    });
    const earliestProcessedDate = new Date(Math.min(...existingDates.map((d) => d.valueOf())));

    // Use the later of dataStartDate or earliestProcessedDate to avoid processing from before data exists
    firstDate = earliestProcessedDate < dataStartDate ? dataStartDate : earliestProcessedDate;
  } else {
    // If no processed days, start from when CubeCobra data begins
    firstDate = dataStartDate;
  }

  const today = new Date();

  // Generate all date keys from firstDate to today
  const allKeys: string[] = [];
  for (let i = firstDate.valueOf(); i <= today.valueOf(); i += 86400000) {
    const date = new Date(i);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
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

  console.log(`Loaded ${keys.length} days of logs`);

  let eloByOracleId: Record<string, number> = {};
  let picksByOracleId: Record<string, number> = {};

  // If we have processed days, load the most recent one to get current state
  if (processedDays.size > 0 && keys.length > 0) {
    // Find the most recent processed day before our first unprocessed day
    const firstUnprocessedKey = keys[0];
    const [firstYear, firstMonth, firstDay] = firstUnprocessedKey!.split('-').map((x) => parseInt(x, 10));
    const firstUnprocessedDate = new Date(firstYear ?? 0, firstMonth ?? 0, firstDay ?? 0).valueOf();

    const previousProcessedKeys = Array.from(processedDays)
      .map((key) => {
        const [year, month, day] = key.split('-').map((x) => parseInt(x, 10));
        return {
          key,
          date: new Date(year ?? 0, month ?? 0, day ?? 0).valueOf(),
        };
      })
      .filter((item) => item.date < firstUnprocessedDate)
      .sort((a, b) => b.date - a.date);

    if (previousProcessedKeys.length > 0) {
      const mostRecentKey = previousProcessedKeys[0]?.key;
      if (mostRecentKey && fs.existsSync(`./temp/global_draft_history/${mostRecentKey}.json`)) {
        console.log(`Loading draft state from most recent processed day: ${mostRecentKey}`);
        const loaded = JSON.parse(
          await fs.promises.readFile(`./temp/global_draft_history/${mostRecentKey}.json`, 'utf-8'),
        );
        eloByOracleId = loaded.eloByOracleId;
        picksByOracleId = loaded.picksByOracleId;
      }
    }
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (!key) continue; // Skip undefined keys

    if (fs.existsSync(`./temp/global_draft_history/${key}.json`)) {
      console.log(`Already finished ${i + 1} / ${keys.length}: for ${key}`);

      // only do this if the next day is not loaded
      if (i + 1 < keys.length && !fs.existsSync(`./temp/global_draft_history/${keys[i + 1]}.json`)) {
        const loaded = JSON.parse(await fs.promises.readFile(`./temp/global_draft_history/${key}.json`, 'utf-8'));

        eloByOracleId = loaded.eloByOracleId;
        picksByOracleId = loaded.picksByOracleId;
      }
    } else {
      console.log(`Starting ${i + 1} / ${keys.length}: for ${key}`);

      // Parse the key to get year, month, day
      const [year, month, day] = key.split('-').map((x) => parseInt(x, 10));

      if (!year || month === undefined || !day) {
        console.error(`Invalid date format for key: ${key}`);
        continue;
      }

      // Calculate start and end timestamps for this day
      const startDate = new Date(year, month, day);
      const endDate = new Date(year, month, day + 1);
      const startTimestamp = startDate.valueOf();
      const endTimestamp = endDate.valueOf();

      // Query drafts for this specific day
      console.log(`Loading drafts for ${key}...`);
      let logRows: any[] = [];
      let lastKey: Record<string, any> | undefined;

      do {
        const result = await draftDao.queryByTypeAndDateRangeUnhydrated(
          DRAFT_TYPES.DRAFT,
          startTimestamp,
          endTimestamp,
          lastKey,
          1000,
        );
        logRows = logRows.concat(result.items.filter((item) => item.complete));
        lastKey = result.lastKey;
      } while (lastKey);

      console.log(`Loaded ${logRows.length} drafts for ${key}`);

      // Save the draft metadata for this day
      // The unhydrated query already returns minimal metadata, so we can save it directly
      const minimalDrafts = logRows.map((draft) => ({
        id: draft.id,
        date: draft.date,
        complete: draft.complete,
        seatNames: draft.seatNames,
        owner: draft.owner,
        cubeOwner: draft.cubeOwner,
        cube: draft.cube,
        name: draft.name,
      }));
      fs.writeFileSync(`./temp/drafts_by_day/${key}.json`, JSON.stringify(minimalDrafts));

      const logRowBatches: any[][] = [];
      const batchSize = 100;
      for (let j = 0; j < logRows.length; j += batchSize) {
        logRowBatches.push(logRows.slice(j, j + batchSize));
      }

      let index = 0;
      for (const batch of logRowBatches) {
        const drafts: DraftType[] = await draftDao.batchGet(batch.filter((item) => item.complete).map((row) => row.id));

        // save these drafts to avoid having to load them again, used in update_metadata_dict
        fs.writeFileSync(
          `./temp/all_drafts/${key}_${index}.json`,
          JSON.stringify(
            drafts
              .filter((draft) => draft.seats && draft.seats[0])
              .map((draft) =>
                draft.seats[0]?.mainboard
                  ?.flat(3)
                  .map((cardIndex) => {
                    if (typeof cardIndex === 'number' && cardIndex < draft.cards.length && cardIndex >= 0) {
                      return draft.cards[cardIndex]?.details?.oracle_id ?? null;
                    }
                    return null;
                  })
                  .filter((oracleId) => oracleId),
              ),
          ),
        );
        index += 1;

        for (const draft of drafts) {
          let picksByCubeAndOracleId = {};
          let passesByCubeAndOracleId = {};
          let mainboardsByCubeAndOracleId = {};
          let sideboardsByCubeAndOracleId = {};
          let eloByCubeAndOracleId = {};
          try {
            if (fs.existsSync(`./temp/cube_draft_history/${draft.cube}.json`)) {
              const loaded = JSON.parse(
                await fs.promises.readFile(`./temp/cube_draft_history/${draft.cube}.json`, 'utf-8'),
              );

              eloByCubeAndOracleId = loaded.eloByCubeAndOracleId;
              picksByCubeAndOracleId = loaded.picksByCubeAndOracleId;
              passesByCubeAndOracleId = loaded.passesByCubeAndOracleId;
              mainboardsByCubeAndOracleId = loaded.mainboardsByCubeAndOracleId;
              sideboardsByCubeAndOracleId = loaded.sideboardsByCubeAndOracleId;
            }

            if (draft.seats[0]?.mainboard) {
              for (const card of draft.seats[0].mainboard.flat(3)) {
                if (typeof card === 'number' && card < draft.cards.length && card >= 0) {
                  if (draft.cards[card]?.details?.oracle_id) {
                    incrementDict(mainboardsByCubeAndOracleId, draft.cards[card]?.details?.oracle_id);
                  }
                }
              }
            }

            if (draft.seats[0]?.sideboard) {
              for (const card of draft.seats[0].sideboard.flat(3)) {
                if (typeof card === 'number' && card < draft.cards.length && card >= 0) {
                  if (draft.cards[card]?.details?.oracle_id) {
                    incrementDict(sideboardsByCubeAndOracleId, draft.cards[card]?.details?.oracle_id);
                  }
                }
              }
            }

            if (
              draft.InitialState &&
              Object.entries(draft.InitialState).length > 0 &&
              draft.seats[0]?.pickorder &&
              draft.type === DRAFT_TYPES.DRAFT
            ) {
              for (let j = 0; j < draft.seats[0].pickorder.length; j++) {
                const drafterState = getDrafterState(draft, 0, j);

                const picked: number = drafterState.selection as number;
                const pack = drafterState.cardsInPack;

                if (picked < 0 || picked >= draft.cards.length || !draft.cards[picked]) {
                  continue;
                }

                if (draft.cards[picked]?.details?.oracle_id) {
                  incrementDict(picksByCubeAndOracleId, draft.cards[picked].details.oracle_id);
                  incrementDict(picksByOracleId, draft.cards[picked].details.oracle_id);
                }

                for (const card of pack) {
                  if (card < draft.cards.length && card >= 0) {
                    if (draft.cards[card]?.details?.oracle_id) {
                      incrementDict(passesByCubeAndOracleId, draft.cards[card]?.details?.oracle_id);
                    }
                  }
                }

                for (const [eloDict, speed] of [
                  [eloByOracleId, ELO_SPEED] as [Record<string, number>, number],
                  [eloByCubeAndOracleId, CUBE_ELO_SPEED] as [Record<string, number>, number],
                ]) {
                  const oracleId = draft.cards[picked]?.details?.oracle_id;
                  if (!oracleId) {
                    continue;
                  }

                  if (!eloDict[oracleId]) {
                    eloDict[oracleId] = DefaultElo;
                  }

                  for (const card of pack) {
                    const cardOracle = draft.cards[card]?.details?.oracle_id;
                    if (cardOracle && card < draft.cards.length && card >= 0) {
                      if (!eloDict[cardOracle]) {
                        eloDict[cardOracle] = DefaultElo;
                      }

                      const [winnerEloChange, loserEloChange] = adjustElo(
                        eloDict[oracleId],
                        eloDict[cardOracle],
                        speed,
                      );

                      eloDict[oracleId] += winnerEloChange;
                      eloDict[cardOracle] += loserEloChange;
                    }
                  }
                }
              }
            }
          } catch (err: any) {
            console.log(`Error processing draft ${draft.id}: ${err.message}`);
            console.log(err);
          }

          await fs.promises.writeFile(
            `./temp/cube_draft_history/${draft.cube}.json`,
            JSON.stringify({
              eloByCubeAndOracleId,
              picksByCubeAndOracleId,
              passesByCubeAndOracleId,
              mainboardsByCubeAndOracleId,
              sideboardsByCubeAndOracleId,
            }),
          );
        }
      }

      console.log(`Finished writing ${i + 1} / ${keys.length + 1}: Processed ${logRows.length} logs for ${key}`);

      // and save the file locally
      await fs.promises.writeFile(
        `./temp/global_draft_history/${key}.json`,
        JSON.stringify({
          eloByOracleId,
          picksByOracleId,
        }),
      );
    }
  }

  console.log('Finished writing global draft history');

  // upload the files to S3
  const allCubes = fs.readdirSync('./temp/cube_draft_history');
  const batches: any[] = [];
  const batchSize = 100;
  for (let j = 0; j < allCubes.length; j += batchSize) {
    batches.push(allCubes.slice(j, j + batchSize));
  }

  let processed = 0;

  for (const batch of batches) {
    console.log(`Uploading ${batch.length} / ${allCubes.length} cube draft histories`);
    await cubeDao.batchPutAnalytics(
      Object.fromEntries(batch.map((cube: string) => [cube.split('.')[0], loadAndProcessCubeDraftAnalytics(cube)])),
    );

    processed += batch.length;
    console.log(`Uploaded ${processed} / ${allCubes.length} cube draft histories`);
  }

  console.log(`Uploaded ${allCubes.length} / ${allCubes.length} cube draft histories`);
  console.log('Complete');

  process.exit();
})();
