const Content = require('../src/dynamo/models/content');

(async () => {
  try {
    console.log('Deleting duped podcasts');

    // scan content
    let lastKey = null;

    let i = 0;

    do {
      const result = await Content.scan(lastKey);

      lastKey = result.lastKey;

      const toDelete = [];

      for (const item of result.items) {
        // if item.typeStatusComp starts with undefined
        if (item.typeStatusComp.startsWith('undefined')) {
          toDelete.push({ id: item.id });
        }
      }

      await Content.batchDelete(toDelete);
      i += 1;
      console.log(`Processed batch ${i}: ${toDelete.length} duped items`);
    } while (lastKey);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
