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

import { downloadJson, listFiles, uploadJson } from './utils/s3';

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

const loadAndProcessCubeDraftAnalytics = async (cube: string) => {
  const source = (await downloadJson(`cube_draft_history/${cube}`)) as {
    eloByCubeAndOracleId: Record<string, number>;
    picksByCubeAndOracleId: Record<string, number>;
    passesByCubeAndOracleId: Record<string, number>;
    mainboardsByCubeAndOracleId: Record<string, number>;
    sideboardsByCubeAndOracleId: Record<string, number>;
  } | null;

  if (!source) {
    return {};
  }

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
  await initializeCardDb(privateDir);

  // List existing files in S3 drafts_by_day to determine which days are already processed
  const existingFiles = await listFiles('drafts_by_day/');
  const processedDays = new Set(
    existingFiles
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.split('/').pop()?.replace('.json', ''))
      .filter((f): f is string => f !== undefined),
  );

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
      if (mostRecentKey) {
        console.log(`Loading draft state from most recent processed day: ${mostRecentKey}`);
        const loaded = await downloadJson(`global_draft_history/${mostRecentKey}.json`);
        if (loaded) {
          eloByOracleId = loaded.eloByOracleId;
          picksByOracleId = loaded.picksByOracleId;
        }
      }
    }
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (!key) continue; // Skip undefined keys

    const exists = await downloadJson(`global_draft_history/${key}.json`);
    if (exists) {
      console.log(`Already finished ${i + 1} / ${keys.length}: for ${key}`);

      // only do this if the next day is not loaded
      if (i + 1 < keys.length) {
        const nextExists = await downloadJson(`global_draft_history/${keys[i + 1]}.json`);
        if (!nextExists) {
          eloByOracleId = exists.eloByOracleId;
          picksByOracleId = exists.picksByOracleId;
        }
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
      await uploadJson(`drafts_by_day/${key}.json`, minimalDrafts);

      const logRowBatches: any[][] = [];
      const batchSize = 100;
      for (let j = 0; j < logRows.length; j += batchSize) {
        logRowBatches.push(logRows.slice(j, j + batchSize));
      }

      let index = 0;
      for (const batch of logRowBatches) {
        const drafts: DraftType[] = await draftDao.batchGet(batch.filter((item) => item.complete).map((row) => row.id));

        // save these drafts to avoid having to load them again, used in update_metadata_dict
        await uploadJson(
          `all_drafts/${key}_${index}.json`,
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
        );
        index += 1;

        for (const draft of drafts) {
          let picksByCubeAndOracleId = {};
          let passesByCubeAndOracleId = {};
          let mainboardsByCubeAndOracleId = {};
          let sideboardsByCubeAndOracleId = {};
          let eloByCubeAndOracleId = {};
          try {
            const loaded = await downloadJson(`cube_draft_history/${draft.cube}.json`);
            if (loaded) {
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

          await uploadJson(`cube_draft_history/${draft.cube}.json`, {
            eloByCubeAndOracleId,
            picksByCubeAndOracleId,
            passesByCubeAndOracleId,
            mainboardsByCubeAndOracleId,
            sideboardsByCubeAndOracleId,
          });
        }
      }

      console.log(`Finished writing ${i + 1} / ${keys.length + 1}: Processed ${logRows.length} logs for ${key}`);

      // and save the file to S3
      await uploadJson(`global_draft_history/${key}.json`, {
        eloByOracleId,
        picksByOracleId,
      });
    }
  }

  console.log('Finished writing global draft history');

  // upload the files to database
  const allCubes = await listFiles('cube_draft_history/');
  const batches: any[] = [];
  const batchSize = 100;
  for (let j = 0; j < allCubes.length; j += batchSize) {
    batches.push(allCubes.slice(j, j + batchSize));
  }

  let processed = 0;

  for (const batch of batches) {
    console.log(`Uploading ${batch.length} / ${allCubes.length} cube draft histories`);
    const cubeData: Record<string, Record<string, Partial<CardAnalytic>>> = {};

    for (const cubeFile of batch) {
      const cubeName = cubeFile.split('/').pop()?.replace('.json', '');
      if (cubeName) {
        cubeData[cubeName] = await loadAndProcessCubeDraftAnalytics(cubeFile.split('/').pop()!);
      }
    }

    await cubeDao.batchPutAnalytics(cubeData);

    processed += batch.length;
    console.log(`Uploaded ${processed} / ${allCubes.length} cube draft histories`);
  }

  console.log(`Uploaded ${allCubes.length} / ${allCubes.length} cube draft histories`);
  console.log('Complete');

  process.exit();
})();
