const fetch = require('node-fetch');
const carddb = require('../util/carddb');
const Cube = require('../dynamo/models/cube');
const _ = require('lodash');

const lastRun = new Date('2000-01-01');

const getMigrations = async () => {
  let page = 1;
  let migrations = [];
  let hasMore = true;
  let nextPage = `https://api.scryfall.com/migrations?page=1`;

  while (hasMore) {
    console.log(`Fetching page ${page}, currently at ${migrations.length} migrations`);
    const response = await fetch(nextPage);
    const data = await response.json();

    hasMore = data.has_more;
    nextPage = data.next_page;

    for (const migration of data.data) {
      const migrationDate = new Date(migration.performed_at);
      if (migrationDate > lastRun) {
        migrations.push(migration);
      } else {
        hasMore = false;
      }
    }

    // wait 50ms between requests
    await new Promise((resolve) => setTimeout(resolve, 50));

    page += 1;
  }

  return migrations;
};

(async () => {
  await carddb.initializeCardDb();

  const migrations = await getMigrations();

  console.log(`Found ${migrations.length} migrations to apply`);

  const toDelete = migrations
    .filter((migration) => migration.migration_strategy === 'delete')
    .map((migration) => migration.old_scryfall_id);

  const toUpdate = {};

  for (let i = migrations.length - 1; i >= 0; i -= 1) {
    if (migrations[i].migration_strategy === 'merge') {
      toUpdate[migrations[i].old_scryfall_id] = migrations[i].new_scryfall_id;
    }

    // if the new old_scryfall_id is a different migration target, we need to update it
    for (const [oldId, newId] of Object.entries(toUpdate)) {
      if (newId === migrations[i].old_scryfall_id) {
        toUpdate[oldId] = toUpdate[newId];
      }
    }
  }

  console.log(`Found ${toDelete.length} cards to delete`);
  console.log(`Found ${Object.keys(toUpdate).length} cards to update`);

  console.log(toUpdate);

  const applyMigration = async (cube) => {
    try {
      const cards = await Cube.getCards(cube.id);
      let changed = false;

      // for each board in cards
      for (const [, list] of Object.entries(cards)) {
        // if list is an array
        if (Array.isArray(list)) {
          // for each card in list
          for (const card of list) {
            // if card is in toDelete
            if (toDelete.includes(card.cardID)) {
              // remove card from list
              list.splice(list.indexOf(card), 1);
              changed = true;
            }

            // if card is in toUpdate
            if (toUpdate[card.cardID]) {
              // replace card.cardID with toUpdate[card.cardID]
              card.cardID = toUpdate[card.cardID];
              changed = true;
            }
          }
        }
      }

      if (!changed) {
        return;
      }

      console.log(`Updating cube ${cube.id}`);

      // update cube
      await Cube.updateCards(cube.id, cards);
    } catch (err) {
      console.log(`Error processing cube ${cube.id}`);
      console.error(err);
    }
  };

  // scan cubes
  let lastKey = null;

  let i = 0;

  do {
    const result = await Cube.scan(lastKey);

    lastKey = result.lastKey;

    const batches = _.chunk(result.items, 25);

    for (const batch of batches) {
      await Promise.all(batch.map(applyMigration));

      i += 1;
      console.log(`Processed batch ${i}: ${batch.length} cubes`);
    }
  } while (lastKey);

  process.exit();
})();
