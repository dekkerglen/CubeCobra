const Package = require('../dynamo/models/package');
const carddb = require('../serverjs/carddb');

(async () => {
  await carddb.initializeCardDb();

  let lastKey = null;

  do {
    console.log('Scanning...', lastKey);
    const result = await Package.scan(lastKey);
    lastKey = result.lastKey;

    const items = result.items.filter((item) => {
      return item.cards.some((card) => {
        // if they are string its ok
        if (typeof card === 'string') {
          return false;
        }

        // if they are objects, they should have an id or an oracle_id
        if (typeof card === 'object') {
          return !card.id && !card.oracle_id;
        }

        // if they are not string or object, they are bad
        return true;
      });
    });

    if (items.length > 0) {
      console.log(`Found ${items.length} bad packages.`);

      await Package.batchDelete(items.map((item) => ({ id: item.id })));
    }
  } while (lastKey);

  process.exit();
})();
