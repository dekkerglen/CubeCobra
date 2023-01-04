/* eslint-disable no-await-in-loop */
// Load Environment Variables
require('dotenv').config();

const EloRating = require('elo-rating');
const fs = require('fs');
const carddb = require('../serverjs/cards');

const Draft = require('../dynamo/models/draft');
const { getDrafterState } = require('../dist/drafting/draftutil');

const ELO_SPEED = 0.01;
const CUBE_ELO_SPEED = 0.25;

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

(async () => {
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

  for (const log of draftLogs) {
    const date = new Date(log.date);
    const [year, month, day] = [date.getFullYear(), date.getMonth(), date.getDate()];

    const key = new Date(year, month, day).valueOf();

    if (!keys.includes(key)) {
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

  for (let i = 0; i < keys.length; i++) {
    if (!fs.existsSync(`./temp/global_draft_history/${keys[i]}.json`)) {
      if (i > 0 && !isLoaded) {
        const loaded = JSON.parse(await fs.promises.readFile(`./temp/global_draft_history/${keys[i - 1]}.json`));

        eloByOracleId = loaded.eloByOracleId;

        isLoaded = true;
      }

      const logRows = logsByDay[keys[i]];

      const logRowBatches = [];
      const batchSize = 25;
      for (let j = 0; j < logRows.length; j += batchSize) {
        logRowBatches.push(logRows.slice(j, j + batchSize));
      }

      for (const batch of logRowBatches) {
        const drafts = await Draft.batchGet(batch.map((row) => row.id));

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
              passesByCubeAndOracleId = loaded.eloByCubeAndOracleId;
              mainboardsByCubeAndOracleId = loaded.mainboardsByCubeAndOracleId;
              sideboardsByCubeAndOracleId = loaded.sideboardsByCubeAndOracleId;
            }

            for (const card of draft.seats[0].Mainboard.flat(3)) {
              if (typeof card === 'number' && card < draft.cards.length && card >= 0) {
                incrementDict(mainboardsByCubeAndOracleId, draft.cards[card].details.oracle_id);
              }
            }

            for (const card of draft.seats[0].Sideboard.flat(3)) {
              if (typeof card === 'number' && card < draft.cards.length && card >= 0) {
                incrementDict(sideboardsByCubeAndOracleId, draft.cards[card].details.oracle_id);
              }
            }

            if (draft.InitialState && Object.entries(draft.InitialState).length > 0 && draft.seats[0].pickorder) {
              for (let j = 0; j < draft.seats[0].pickorder.length; j++) {
                const drafterState = getDrafterState(draft, 0, j);

                const picked = drafterState.selection;
                const pack = drafterState.cardsInPack;

                if (picked < 0 || picked >= draft.cards.length) {
                  // eslint-disable-next-line no-continue
                  continue;
                }

                incrementDict(picksByCubeAndOracleId, draft.cards[picked].details.oracle_id);

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
        `Finished writing ${i + 1} / ${keys.length + 1}: Processed ${logRows.length} logs for ${new Date(keys[i])}`,
      );

      // and save the file locally
      await fs.promises.writeFile(
        `./temp/global_draft_history/${keys[i]}.json`,
        JSON.stringify({
          eloByOracleId,
        }),
      );
    }
  }

  // now we have all the data, we can update the database

  process.exit();
})();
