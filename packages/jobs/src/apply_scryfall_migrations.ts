import { cubeDao, migrationTaskDao } from '@server/dynamo/daos';
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import { MigrationTaskStatus } from '@utils/datatypes/MigrationTask';
import _ from 'lodash';
import fetch from 'node-fetch';
import path from 'path';

interface ScryfallMigration {
  id: string;
  old_scryfall_id: string;
  new_scryfall_id: string;
  migration_strategy: 'merge' | 'delete';
  performed_at: string;
}

interface MigrationData {
  has_more: boolean;
  next_page?: string;
  data: ScryfallMigration[];
}

const getMigrations = async (lastMigrationDate: string): Promise<ScryfallMigration[]> => {
  let page = 1;
  const migrations: ScryfallMigration[] = [];
  let hasMore = true;
  let nextPage = `https://api.scryfall.com/migrations?page=1`;
  const lastRun = new Date(lastMigrationDate);

  while (hasMore) {
    console.log(`Fetching page ${page}, currently at ${migrations.length} migrations`);
    const response = await fetch(nextPage);
    const data = (await response.json()) as MigrationData;

    hasMore = data.has_more;
    if (data.next_page) {
      nextPage = data.next_page;
    }

    for (const migration of data.data) {
      const migrationDate = new Date(migration.performed_at);
      if (migrationDate > lastRun) {
        migrations.push(migration);
      } else {
        hasMore = false;
        break;
      }
    }

    // wait 50ms between requests
    await new Promise((resolve) => setTimeout(resolve, 50));

    page += 1;
  }

  return migrations;
};

const applyMigrations = async (taskId: string) => {
  await migrationTaskDao.updateStep(taskId, 'Initializing card database');

  const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
  await initializeCardDb(privateDir);

  // Get the last successful migration date
  await migrationTaskDao.updateStep(taskId, 'Fetching last migration date');
  const lastTask = await migrationTaskDao.getMostRecentSuccessful();
  const lastMigrationDate = lastTask?.lastMigrationDate || '2000-01-01T00:00:00.000Z';

  await migrationTaskDao.updateStep(taskId, 'Fetching migrations from Scryfall');
  const migrations = await getMigrations(lastMigrationDate);

  console.log(`Found ${migrations.length} migrations to apply`);

  if (migrations.length === 0) {
    console.log('No migrations to apply');
    return {
      migrationsProcessed: 0,
      cubesAffected: 0,
      cardsDeleted: 0,
      cardsMerged: 0,
      lastMigrationDate,
    };
  }

  await migrationTaskDao.updateStep(taskId, 'Processing migration strategies');

  const toDelete = migrations
    .filter((migration) => migration.migration_strategy === 'delete')
    .map((migration) => migration.old_scryfall_id);

  const toUpdate: Record<string, string> = {};

  for (let i = migrations.length - 1; i >= 0; i -= 1) {
    const migration = migrations[i];
    if (!migration) continue;

    if (migration.migration_strategy === 'merge') {
      toUpdate[migration.old_scryfall_id] = migration.new_scryfall_id;
    }

    // if the new old_scryfall_id is a different migration target, we need to update it
    for (const [oldId, newId] of Object.entries(toUpdate)) {
      if (newId === migration.old_scryfall_id && toUpdate[newId]) {
        toUpdate[oldId] = toUpdate[newId];
      }
    }
  }

  console.log(`Found ${toDelete.length} cards to delete`);
  console.log(`Found ${Object.keys(toUpdate).length} cards to update`);

  let cubesAffected = 0;
  let totalCardsDeleted = 0;
  let totalCardsMerged = 0;

  const applyMigration = async (cubeId: string) => {
    try {
      const cards = await cubeDao.getCards(cubeId);
      let changed = false;
      let cardsDeleted = 0;
      let cardsMerged = 0;

      // for each board in cards
      for (const [, list] of Object.entries(cards)) {
        // if list is an array
        if (Array.isArray(list)) {
          // for each card in list (iterate backwards to safely remove)
          for (let i = list.length - 1; i >= 0; i -= 1) {
            const card = list[i];

            // if card is in toDelete
            if (toDelete.includes(card.cardID)) {
              // remove card from list
              list.splice(i, 1);
              changed = true;
              cardsDeleted += 1;
            } else if (toUpdate[card.cardID]) {
              // replace card.cardID with toUpdate[card.cardID]
              card.cardID = toUpdate[card.cardID];
              changed = true;
              cardsMerged += 1;
            }
          }
        }
      }

      if (!changed) {
        return { changed: false, cardsDeleted: 0, cardsMerged: 0 };
      }

      console.log(`Updating cube ${cubeId}: ${cardsDeleted} deleted, ${cardsMerged} merged`);

      // update cube
      await cubeDao.updateCards(cubeId, cards);

      return { changed: true, cardsDeleted, cardsMerged };
    } catch (err) {
      console.log(`Error processing cube ${cubeId}`);
      console.error(err);
      return { changed: false, cardsDeleted: 0, cardsMerged: 0 };
    }
  };

  // scan cubes
  let lastKey: Record<string, any> | undefined;
  let batchNum = 0;

  await migrationTaskDao.updateStep(taskId, 'Processing cubes');

  do {
    const result = await cubeDao.queryAllCubes('popularity', false, lastKey, 100);
    lastKey = result.lastKey;

    const batches = _.chunk(result.items, 25);

    for (const batch of batches) {
      const results = await Promise.all(batch.map((cube) => applyMigration(cube.id)));

      for (const result of results) {
        if (result.changed) {
          cubesAffected += 1;
        }
        totalCardsDeleted += result.cardsDeleted;
        totalCardsMerged += result.cardsMerged;
      }

      batchNum += 1;
      console.log(`Processed batch ${batchNum}: ${batch.length} cubes`);
    }
  } while (lastKey);

  // Get the most recent migration date
  const mostRecentMigrationDate = migrations.reduce((latest, migration) => {
    const migrationDate = new Date(migration.performed_at);
    return migrationDate > new Date(latest) ? migration.performed_at : latest;
  }, lastMigrationDate);

  return {
    migrationsProcessed: migrations.length,
    cubesAffected,
    cardsDeleted: totalCardsDeleted,
    cardsMerged: totalCardsMerged,
    lastMigrationDate: mostRecentMigrationDate,
  };
};

// Main execution when run directly
if (require.main === module) {
  (async () => {
    try {
      // Create a new migration task
      const task = await migrationTaskDao.create({
        status: MigrationTaskStatus.PENDING,
        lastMigrationDate: '',
        migrationsProcessed: 0,
        cubesAffected: 0,
        cardsDeleted: 0,
        cardsMerged: 0,
        step: 'Initializing',
      });
      console.log(`Created migration task ${task.id}`);

      await migrationTaskDao.markAsStarted(task.id);

      const result = await applyMigrations(task.id);

      await migrationTaskDao.markAsCompleted(task.id);

      // Update the task with the final stats
      const updatedTask = await migrationTaskDao.getById(task.id);
      if (updatedTask) {
        updatedTask.lastMigrationDate = result.lastMigrationDate;
        updatedTask.migrationsProcessed = result.migrationsProcessed;
        updatedTask.cubesAffected = result.cubesAffected;
        updatedTask.cardsDeleted = result.cardsDeleted;
        updatedTask.cardsMerged = result.cardsMerged;
        await migrationTaskDao.update(updatedTask);
      }

      console.log('Migration completed successfully');
      console.log(`Migrations processed: ${result.migrationsProcessed}`);
      console.log(`Cubes affected: ${result.cubesAffected}`);
      console.log(`Cards deleted: ${result.cardsDeleted}`);
      console.log(`Cards merged: ${result.cardsMerged}`);
      console.log(`Last migration date: ${result.lastMigrationDate}`);

      process.exit(0);
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  })();
}

export { applyMigrations };
