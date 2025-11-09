/* eslint-disable no-console */
import dotenv from 'dotenv';

import 'module-alias/register';
dotenv.config({ path: require('path').join(__dirname, '..', '..', '.env') });

import EloRating from 'elo-rating';
import fs from 'fs';

import { DefaultElo } from '@utils/datatypes/Card';
import type { CardAnalytic } from '@utils/datatypes/CubeAnalytic';
import type DraftType from '@utils/datatypes/Draft';
import CubeAnalytic from '@server/dynamo/models/cubeAnalytic';
import Draft from '@server/dynamo/models/draft';
import { initializeCardDb } from '@server/util/cardCatalog';
import { getDrafterState } from '@utils/draftutil';
import path from 'path/win32';

// global listeners for promise rejections
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise ', p, ' reason: ', reason);
});

const ELO_SPEED = 0.1;
const CUBE_ELO_SPEED = 2;

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

  const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
  await initializeCardDb(privateDir);

  const logsByDay: any = {};
  const keys: string[] = [];

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

  for (const log of draftLogs) {
    if (log.complete && log.date) {
      const date = new Date(log.date);
      const [year, month, day] = [date.getFullYear(), date.getMonth(), date.getDate()];

      const key = `${year}-${month}-${day}`;

      if (!logsByDay[key]) {
        keys.push(key);
        logsByDay[key] = [];
      }
      logsByDay[key].push(log);
    }
  }

  console.log('Buckets created');

  // sort the keys ascending
  keys.sort((a, b) => {
    const [aYear, aMonth, aDay] = a.split('-').map((x) => parseInt(x, 10));
    const [bYear, bMonth, bDay] = b.split('-').map((x) => parseInt(x, 10));

    if (aYear !== undefined && bYear !== undefined && aYear !== bYear) {
      return aYear - bYear;
    }

    if (aMonth !== undefined && bMonth !== undefined && aMonth !== bMonth) {
      return aMonth - bMonth;
    }

    if (aDay !== undefined && bDay !== undefined) {
      return aDay - bDay;
    }

    return 0;
  });

  console.log(`Loaded ${keys.length} days of logs`);

  for (const key of keys) {
    const logRows = logsByDay[key] || [];

    fs.writeFileSync(`./temp/drafts_by_day/${key}.json`, JSON.stringify(logRows));
  }

  let eloByOracleId: Record<string, number> = {};
  let picksByOracleId: Record<string, number> = {};

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
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
      const logRows = logsByDay[key as keyof typeof logsByDay] || [];

      const logRowBatches: DraftType[][] = [];
      const batchSize = 100;
      for (let j = 0; j < logRows.length; j += batchSize) {
        logRowBatches.push(logRows.slice(j, j + batchSize));
      }

      let index = 0;
      for (const batch of logRowBatches) {
        const drafts: DraftType[] = await Draft.batchGet(batch.filter((item) => item.complete).map((row) => row.id));

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
              draft.type === Draft.TYPES.DRAFT
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
    await CubeAnalytic.batchPut(
      Object.fromEntries(batch.map((cube: string) => [cube.split('.')[0], loadAndProcessCubeDraftAnalytics(cube)])),
    );

    processed += batch.length;
    console.log(`Uploaded ${processed} / ${allCubes.length} cube draft histories`);
  }

  console.log(`Uploaded ${allCubes.length} / ${allCubes.length} cube draft histories`);
  console.log('Complete');

  process.exit();
})();
