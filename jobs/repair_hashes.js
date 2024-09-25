const _ = require('lodash');
const Cube = require('../dynamo/models/cube');
const CubeHash = require('../dynamo/models/cubeHash');
const carddb = require('../serverjs/carddb');

(async () => {
  try {
    await carddb.initializeCardDb();
    console.log('Repairing hashes');

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
            try {
              const cards = await Cube.getCards(cube.id);

              const oldHashes = await CubeHash.getHashesByCubeId(cube.id);
              const newHashes = CubeHash.getHashRowsForCube(cube, cards);

              // get hashes to delete with deep object equality
              // delete old hash row if no new hash row has this hash
              const hashesToDelete = oldHashes.filter((oldHashRow) => {
                return !newHashes.some((newHashRow) => oldHashRow.hash === newHashRow.hash);
              });

              // get hashes to put with deep object equality
              // put/update hash row if new hash row doesn't match to an old one
              const hashesToPut = newHashes.filter((newHashRow) => {
                return !oldHashes.some((oldHashRow) => _.isEqual(newHashRow, oldHashRow));
              });

              // put hashes to delete
              if (hashesToDelete.length > 0) {
                console.log(`Deleting ${hashesToDelete.length} hashes for cube ${cube.id}`);
                await CubeHash.batchDelete(hashesToDelete.map((hashRow) => ({ hash: hashRow.hash, cube: cube.id })));
              }

              // put hashes to put
              if (hashesToPut.length > 0) {
                console.log(`Putting ${hashesToPut.length} hashes for cube ${cube.id}`);
                await CubeHash.batchPut(hashesToPut);
              }
            } catch (err) {
              console.log(`Error processing cube ${cube.id}`);
              console.error(err);
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
