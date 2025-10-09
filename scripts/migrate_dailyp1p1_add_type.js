// Load Environment Variables
require('dotenv').config();

const dailyP1P1Model = require('../build/dynamo/models/dailyP1P1');

(async () => {
  try {
    console.log('Migrating DailyP1P1 records to add type field');

    let lastKey = null;
    let totalProcessed = 0;

    do {
      const result = await dailyP1P1Model.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        for (const item of result.items) {
          // Only update if type is missing
          if (!item.type) {
            await dailyP1P1Model.update({
              ...item,
              type: 'HISTORY',
            });
            totalProcessed += 1;
            console.log(`Updated record ${item.id} (${totalProcessed} total)`);
          }
        }
      }
    } while (lastKey);

    console.log(`Migration complete. Updated ${totalProcessed} records.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
