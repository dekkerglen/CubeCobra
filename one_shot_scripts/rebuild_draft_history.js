// Load Environment Variables
require('dotenv').config();

const fs = require('fs');
const EloRating = require('elo-rating');
const carddb = require('../serverjs/cards');

const Draft = require('../dynamo/models/draft');
const { getDrafterState } = require('../dist/drafting/draftutil');

let checkpoint = 0;

const ELO_SPEED = 0.01;
const CUBE_ELO_SPEED = 0.25;

const adjustElo = (winnerElo, loserElo, speed) => {
  const { playerRating, opponentRating } = EloRating.calculate(winnerElo, loserElo, true);

  const winnerEloChange = (playerRating - winnerElo) * speed;
  const loserEloChange = (opponentRating - loserElo) * speed;

  return [winnerEloChange, loserEloChange];
};

(async () => {
  await carddb.initializeCardDb();

  let logsByDay = {};
  let keys = [];
  if (checkpoint < 1) {
    // load all draftlogs into memory
    let lastKey = null;
    let drafts = [];
    do {
      const result = await Draft.scan(1000000, lastKey);
      drafts = drafts.concat(result.items);
      lastKey = result.lastKey;

      console.log(`Loaded ${drafts.length} draftlogs`);
    } while (lastKey);

    console.log('Loaded all draftlogs');

    for (const log of drafts) {
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

    // save the files
    fs.writeFileSync('temp/draftLogsByDay.json', JSON.stringify({ logsByDay, keys }));
    checkpoint += 1;
  } else {
    // load the files
    const loaded = JSON.parse(fs.readFileSync('temp/draftLogsByDay.json'));
    logsByDay = loaded.logsByDay;
    keys = loaded.keys;
  }

  console.log(`Loaded ${keys.length} days of logs`);

  const eloByOracleId = {};
  const eloByCubeAndOracleId = {};

  if (checkpoint >= 2) {
    // load the cubes
    const loaded = JSON.parse(fs.readFileSync(`temp/draft/checkpoint_${keys[checkpoint - 2]}.json`));
    Object.assign(eloByOracleId, loaded.eloByOracleId);
    Object.assign(eloByCubeAndOracleId, loaded.eloByCubeAndOracleId);
  }

  for (let i = checkpoint - 1; i < keys.length; i++) {
    const logRows = logsByDay[keys[i]];
    const drafts = await Draft.batchGet(logRows.map((row) => row.id));

    for (const draft of drafts) {
      try {
        if (draft.InitialState) {
          if (!eloByCubeAndOracleId[draft.cube]) {
            eloByCubeAndOracleId[draft.cube] = {};
          }
          for (let j = 0; j < draft.seats[0].Pickorder.length; j++) {
            const drafterState = getDrafterState(draft, 0, j);

            const picked = drafterState.selection;
            const pack = drafterState.cardsInPack;

            for (const [eloDict, speed] of [
              [eloByOracleId, ELO_SPEED],
              [eloByCubeAndOracleId[draft.cube], CUBE_ELO_SPEED],
            ]) {
              if (!eloDict[draft.cards[picked].details.oracle_id]) {
                eloDict[draft.cards[picked].details.oracle_id] = 1200;
              }
              for (const card of pack) {
                if (card < draft.cards.length) {
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
      }
    }

    console.log(
      `Finished checkpoint ${checkpoint} / ${keys.length + 1}: Processed ${logRows.length} logs for ${new Date(
        keys[i],
      )}`,
    );
    fs.writeFileSync(`temp/draft/checkpoint_${keys[i]}.json`, JSON.stringify({ eloByOracleId, eloByCubeAndOracleId }));

    checkpoint += 1;
  }

  process.exit();
})();
