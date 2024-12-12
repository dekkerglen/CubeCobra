// Load Environment Variables
require('dotenv').config();

const fs = require('fs');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamObject } = require('stream-json/streamers/StreamObject');
const { Writable } = require('stream');

(async () => {
  const potentiallyMaliciousOwners = [];

  const pipeline = chain([
    fs.createReadStream('empty_cubes_by_owner.json'),
    parser(),
    streamObject(),
    new Writable({
      objectMode: true,
      write({ key, value }, encoding, callback) {
        const cubes = value;

        // and the 
        if (cubes.length >= 1 && cubes.every(cube => cube.cardCount === 0)) {
          potentiallyMaliciousOwners.push([
            key,
            ...cubes.map(cube => cube.name),
          ]);
        }

        callback();
      },
    }),
  ]);

  pipeline.on('end', () => {
    console.log(`Found ${potentiallyMaliciousOwners.length} potentially malicious owners`);
    // write a csv
    fs.writeFileSync('potentially_malicious_users.csv', potentiallyMaliciousOwners.map((strings) => strings.join(',')).join('\n'));
    process.exit();
  });

  pipeline.on('error', (err) => {
    console.error('Error processing JSON stream:', err);
    process.exit(1);
  });
})();
