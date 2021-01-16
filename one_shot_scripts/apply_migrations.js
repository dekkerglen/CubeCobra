// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const carddb = require('../serverjs/cards');
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const Draft = require('../models/draft');
const GridDraft = require('../models/gridDraft');
const cubeMigrations = require('../models/migrations/cubeMigrations');
const deckMigrations = require('../models/migrations/deckMigrations');
const draftMigrations = require('../models/migrations/draftMigrations');
const gridDraftMigrations = require('../models/migrations/gridDraftMigrations');
const { applyPendingMigrationsPre } = require('../models/migrations/migrationMiddleware');

const MIGRATABLE = Object.freeze([
  { name: 'Cube', model: Cube, migrate: applyPendingMigrationsPre(cubeMigrations) },
  { name: 'Deck', model: Deck, migrate: applyPendingMigrationsPre(deckMigrations) },
  { name: 'Draft', model: Draft, migrate: applyPendingMigrationsPre(draftMigrations) },
  { name: 'GridDraft', model: GridDraft, migrate: applyPendingMigrationsPre(gridDraftMigrations) },
]);

const migratableDocsQuery = (currentSchemaVersion) => ({
  $or: [{ schemaVersion: { $exists: false } }, { schemaVersion: { $lt: currentSchemaVersion } }],
});

const BATCH_SIZE = 500;

(async () => {
  await carddb.initializeCardDb('private', true);
  await mongoose.connect(process.env.MONGODB_URL);
  for (const { name, model, migrate } of MIGRATABLE) {
    const query = migratableDocsQuery(model.CURRENT_SCHEMA_VERSION);
    const count = await model.countDocuments(query);
    const cursor = model.find(query).cursor();
    let totalSuccesses = 0;

    const asyncMigrate = async (doc) => {
      let migrated;
      try {
        migrated = await migrate(doc);
      } catch (e) {
        console.error(`Could not migrate ${name} with id ${doc._id}.`, e);
        return 0;
      }
      if (migrated) {
        try {
          await migrated.save();
        } catch (e) {
          console.error(`Failed to save migrated ${name} with id ${doc._id}.`, e);
          return 0;
        }
      } else {
        console.error(`${name} with id ${doc._id} was in an invalid format.`);
        return 0;
      }
      return 1;
    };

    // batch them in 100
    for (let i = 0; i < count; ) {
      const maxIndex = Math.min(i + BATCH_SIZE, count);
      const num = maxIndex - i;
      const migrations = [];
      for (; i < maxIndex; i++) {
        let doc;
        try {
          doc = await cursor.next();
        } catch (e) {
          console.warn(`Could not load ${name} at index ${i}.`, e);
        }
        if (doc) {
          migrations.push(asyncMigrate(doc));
        }
      }
      const successes = (await Promise.all(migrations)).reduce((acc, x) => acc + x, 0);
      totalSuccesses += successes;
      console.log(
        `Finished: ${i} of ${count} ${name}s. ${successes}/${num} were successful for a total of ${totalSuccesses} successfully migrated.`,
      );
    }
  }
  mongoose.disconnect();
  console.log('done');
})();
