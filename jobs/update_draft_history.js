/* eslint-disable no-await-in-loop */
// Load Environment Variables
require('dotenv').config();

const EloRating = require('elo-rating');
const fs = require('fs');
const carddb = require('../serverjs/carddb');
const CubeAnalytic = require('../dynamo/models/cubeAnalytic');

const Draft = require('../dynamo/models/draft');
const { getDrafterState } = require('../dist/drafting/draftutil');

const ELO_SPEED = 0.1;
const CUBE_ELO_SPEED = 2;

const adjustElo = (winnerElo, loserElo, speed) => {
  const { playerRating, opponentRating } = EloRating.calculate(winnerElo, loserElo, true);

  const winnerEloChange = (playerRating - winnerElo) * speed;
  const loserEloChange = (opponentRating - loserElo) * speed;

  return [winnerEloChange, loserEloChange];
};

const incrementDict = (dict, key) => {
  if (!dict[key]) {
    dict[key] = 0;
  }

  dict[key] += 1;
};

const loadAndProcessCubeDraftAnalytics = (cube) => {
  const source = JSON.parse(fs.readFileSync(`./temp/cube_draft_history/${cube}`));

  const cubeAnalytics = {};

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

  await carddb.initializeCardDb();

  const logsByDay = {};
  const keys = [];

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
  // save into file
  fs.writeFileSync('./temp/draftLogs.json', JSON.stringify(draftLogs));

  for (const log of draftLogs) {
    const date = new Date(log.date);
    const [year, month, day] = [date.getFullYear(), date.getMonth(), date.getDate()];

    const key = new Date(year, month, day).valueOf();

    if (!logsByDay[key]) {
      keys.push(key);
      logsByDay[key] = [];
    }
    logsByDay[key].push(log);
  }

  console.log('Buckets created');

  // sort the keys ascending
  keys.sort((a, b) => a - b);

  console.log(`Loaded ${keys.length} days of logs`);

  let isLoaded = false;

  let eloByOracleId = {};
  let picksByOracleId = {};

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (fs.existsSync(`./temp/global_draft_history/${key}.json`)) {
      console.log(`Already finished ${i + 1} / ${keys.length + 1}: for ${new Date(key)}`);
    } else {
      if (i > 0 && !isLoaded) {
        const loaded = JSON.parse(await fs.promises.readFile(`./temp/global_draft_history/${keys[i - 1]}.json`));

        eloByOracleId = loaded.eloByOracleId;
        picksByOracleId = loaded.picksByOracleId;

        isLoaded = true;
      }

      const logRows = logsByDay[key] || [];

      const logRowBatches = [];
      const batchSize = 100;
      for (let j = 0; j < logRows.length; j += batchSize) {
        logRowBatches.push(logRows.slice(j, j + batchSize));
      }

      let index = 0;
      for (const batch of logRowBatches) {
        const drafts = await Draft.batchGet(batch.map((row) => row.id));

        // save these drafts to avoid having to load them again
        fs.writeFileSync(
          `./temp/all_drafts/${key}_${index}.json`,
          JSON.stringify(
            drafts.map((draft) =>
              draft.seats[0].mainboard
                .flat(3)
                .map((cardIndex) => {
                  if (typeof cardIndex === 'number' && cardIndex < draft.cards.length && cardIndex >= 0) {
                    return draft.cards[cardIndex].details.oracle_id;
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
              const loaded = JSON.parse(await fs.promises.readFile(`./temp/cube_draft_history/${draft.cube}.json`));

              eloByCubeAndOracleId = loaded.eloByCubeAndOracleId;
              picksByCubeAndOracleId = loaded.picksByCubeAndOracleId;
              passesByCubeAndOracleId = loaded.passesByCubeAndOracleId;
              mainboardsByCubeAndOracleId = loaded.mainboardsByCubeAndOracleId;
              sideboardsByCubeAndOracleId = loaded.sideboardsByCubeAndOracleId;
            }

            for (const card of draft.seats[0].mainboard.flat(3)) {
              if (typeof card === 'number' && card < draft.cards.length && card >= 0) {
                incrementDict(mainboardsByCubeAndOracleId, draft.cards[card].details.oracle_id);
              }
            }

            for (const card of draft.seats[0].sideboard.flat(3)) {
              if (typeof card === 'number' && card < draft.cards.length && card >= 0) {
                incrementDict(sideboardsByCubeAndOracleId, draft.cards[card].details.oracle_id);
              }
            }

            if (
              draft.InitialState &&
              Object.entries(draft.InitialState).length > 0 &&
              draft.seats[0].pickorder &&
              draft.type === Draft.TYPES.DRAFT
            ) {
              for (let j = 0; j < draft.seats[0].pickorder.length; j++) {
                const drafterState = getDrafterState(draft, 0, j);

                const picked = drafterState.selection;
                const pack = drafterState.cardsInPack;

                if (picked < 0 || picked >= draft.cards.length) {
                  // eslint-disable-next-line no-continue
                  continue;
                }

                incrementDict(picksByCubeAndOracleId, draft.cards[picked].details.oracle_id);
                incrementDict(picksByOracleId, draft.cards[picked].details.oracle_id);

                for (const card of pack) {
                  if (card < draft.cards.length && card >= 0) {
                    incrementDict(passesByCubeAndOracleId, draft.cards[card].details.oracle_id);
                  }
                }

                for (const [eloDict, speed] of [
                  [eloByOracleId, ELO_SPEED],
                  [eloByCubeAndOracleId, CUBE_ELO_SPEED],
                ]) {
                  if (!eloDict[draft.cards[picked].details.oracle_id]) {
                    eloDict[draft.cards[picked].details.oracle_id] = 1200;
                  }
                  for (const card of pack) {
                    if (card < draft.cards.length && card >= 0) {
                      if (!eloDict[draft.cards[card].details.oracle_id]) {
                        eloDict[draft.cards[card].details.oracle_id] = 1200;
                      }

                      const [winnerEloChange, loserEloChange] = adjustElo(
                        eloDict[draft.cards[picked].details.oracle_id],
                        eloDict[draft.cards[card].details.oracle_id],
                        speed,
                      );

                      eloDict[draft.cards[picked].details.oracle_id] += winnerEloChange;
                      eloDict[draft.cards[card].details.oracle_id] += loserEloChange;
                    }
                  }
                }
              }
            }
          } catch (err) {
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

      console.log(
        `Finished writing ${i + 1} / ${keys.length + 1}: Processed ${logRows.length} logs for ${new Date(key)}`,
      );

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

  // upload the files to S3
  const allCubes = fs.readdirSync('./temp/cube_draft_history');
  const batches = [];
  const batchSize = 100;
  for (let j = 0; j < allCubes.length; j += batchSize) {
    batches.push(allCubes.slice(j, j + batchSize));
  }

  let processed = 0;

  for (const batch of batches) {
    await CubeAnalytic.batchPut(
      Object.fromEntries(batch.map((cube) => [cube.split('.')[0], loadAndProcessCubeDraftAnalytics(cube)])),
    );

    processed += batch.length;
    console.log(`Uploaded ${processed} / ${allCubes.length} cube draft histories`);
  }

  console.log(`Uploaded ${allCubes.length} / ${allCubes.length} cube draft histories`);
  console.log('Complete');

  process.exit();
})();
