// Load Environment Variables
require('dotenv').config();

const Cube = require('../src/dynamo/models/cube');
const fs = require('fs');

(async () => {
  let cubesByOwner = {};
  let lastKey = null;

  do {
    const response = await Cube.scan(lastKey);
    lastKey = response.lastKey;

    for (const cube of response.items) {
      if (!cubesByOwner[cube.owner]) {
        cubesByOwner[cube.owner] = [];
      }

      cubesByOwner[cube.owner].push(cube);
    }

    console.log(`Scanned ${response.items.length} cubes`);
    console.log(`Found ${Object.keys(cubesByOwner).length} owners`);
  } while (lastKey);

  // write to file
  fs.writeFileSync('empty_cubes_by_owner.json', JSON.stringify(cubesByOwner, null, 2));

  process.exit();
})();
