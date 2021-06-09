// Load Environment Variables
require('dotenv').config();
const mongoose = require('mongoose');

const Cube = require('../models/cube');
const Deck = require('../models/deck');
const Draft = require('../models/draft');
const GridDraft = require('../models/gridDraft');
const cubeMigrations = require('../models/migrations/cubeMigrations');
const deckMigrations = require('../models/migrations/deckMigrations');
const draftMigrations = require('../models/migrations/draftMigrations');
const gridDraftMigrations = require('../models/migrations/gridDraftMigrations');
const { applyPendingMigrationsPre } = require('../models/migrations/migrationMiddleware');
const carddb = require('../serverjs/cards');

const MIGRATABLE = Object.freeze([
  { name: 'GridDraft', model: GridDraft, migrate: applyPendingMigrationsPre(gridDraftMigrations) },
  { name: 'Cube', model: Cube, migrate: applyPendingMigrationsPre(cubeMigrations) },
  { name: 'Deck', model: Deck, migrate: applyPendingMigrationsPre(deckMigrations) },
  { name: 'Draft', model: Draft, migrate: applyPendingMigrationsPre(draftMigrations) },
]);

const migratableDocsQuery = (currentSchemaVersion) => {
  if (currentSchemaVersion === 1) {
    return { schemaVersion: null };
  }
  return { schemaVersion: currentSchemaVersion - 1 };
};

(async () => {
  await carddb.initializeCardDb('private', true);
  await mongoose.connect(process.env.MONGODB_URL);
  for (const { name, model, migrate } of MIGRATABLE) {
    console.log(`Starting ${name}...`);
    const query = migratableDocsQuery(model.CURRENT_SCHEMA_VERSION);

    const count = await model.estimatedDocumentCount(query);
    const cursor = model.find(query).cursor();
    console.log(`Found ${count} documents`);

    let totalProcessed = 0;

    const asyncMigrate = async (doc) => {
      if (doc.schemaVersion === model.CURRENT_SCHEMA_VERSION) {
        totalProcessed += 1;
        console.log(`Skipping ${name} ${totalProcessed}: ${doc._id}`);
        return 0;
      }
      let migrated;
      try {
        migrated = await migrate(doc);
      } catch (e) {
        console.error(`Could not migrate ${name} with id ${doc._id}.`);
        console.debug(e);
        return 0;
      }
      if (migrated) {
        try {
          await migrated.save();
          totalProcessed += 1;
          console.log(`Finished ${name} ${totalProcessed}: ${migrated._id}`);
        } catch (e) {
          console.error(`Failed to save migrated ${name} with id ${doc._id}.`);
          console.debug(e);
          return 0;
        }
      } else {
        console.error(`${name} with id ${doc._id} was in an invalid format.`);
        return 0;
      }
      return 1;
    };

    await cursor.eachAsync(asyncMigrate, { parallel: 100 });

    console.log(`Finished: ${name}s. ${totalProcessed} were successful.`);
  }
  mongoose.disconnect();
  console.log('done');
  process.exit();
})();
