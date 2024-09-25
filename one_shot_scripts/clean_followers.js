const _ = require('lodash');
const Cube = require('../dynamo/models/cube');
const carddb = require('../serverjs/carddb');

(async () => {
  try {
    await carddb.initializeCardDb();
    console.log('Cleaning cube followers');

    // scan cubes
    let lastKey = null;

    let i = 0;

    do {
      const result = await Cube.scan(lastKey);

      lastKey = result.lastKey;

      const batches = _.chunk(result.items, 25);

      for (const batch of batches) {
        await Promise.all(
          batch.map(async (cube) => {
            if ((cube.following || []).some((f) => typeof f !== 'string')) {
              console.log(`Cleaning cube ${cube.id}`);
              cube.following = cube.following.filter((f) => typeof f === 'string');
              await Cube.update(cube);
            }
          }),
        );

        i += 1;
        console.log(`Processed batch ${i}: ${batch.length} cubes`);
      }
    } while (lastKey);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
