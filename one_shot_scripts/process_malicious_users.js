// Load Environment Variables
require('dotenv').config();

const fs = require('fs');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamObject } = require('stream-json/streamers/StreamObject');
const { Writable } = require('stream');

const Draft = require('../dynamo/models/draft');

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
        console.log(`Checking ${key} with ${cubes.length} cubes`);

        // If the user has at least one cube and all of their cubes are empty, they are potentially malicious
        if (cubes.length >= 1 && cubes.every(cube => cube.cardCount === 0)) {
        
          // If the user has more than 5 cubes, they are potentially malicious
          if(cubes.length > 5) {
            potentiallyMaliciousOwners.push([
              key,
              ...cubes.map(cube => cube.name),
            ]);
            callback();
            return;
          }

          // othewise, check if they have drafts

          Draft.getByOwner(key, null, 10).then((drafts) => {

            // if the user has drafts, they are probably not malicious  
            if (drafts.items.length === 0) {
              potentiallyMaliciousOwners.push([
                key,
                ...cubes.map(cube => cube.name),
              ]);
            }

            callback();
          });
        } else {
          callback();
        }
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
