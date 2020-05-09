import dotenv from 'dotenv';
import mongoose from 'mongoose';

// eslint-disable-next-line import/extensions
import Cube from '../models/cube.js';

dotenv.config();

const batchSize = 100;

const mapPack = (pack) => {
  if (pack.trash) {
    return pack;
  }
  return { trash: 0, filters: pack };
};

const migratecube = async (cube) => {
  cube.draft_formats.map((format) => {
    const packs = JSON.parse(format.packs);
    if (packs[0] && packs[0].trash) {
      return format;
    }
    format.packs = JSON.stringify(packs.map(mapPack));
    return format;
  });
  return cube;
};

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const count = await Cube.countDocuments();
    const cursor = Cube.find().lean().cursor();
    for (let i = 0; i < count; i += batchSize) {
      const cubes = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          // eslint-disable-next-line no-await-in-loop
          const cube = await cursor.next();
          if (cube) {
            cubes.push(migratecube(cube));
          }
        }
      }
      // eslint-disable-next-line no-await-in-loop
      const operations = (await Promise.all(cubes))
        .filter((cube) => cube)
        .map((cube) => ({
          replaceOne: {
            filter: { _id: cube._id },
            replacement: cube,
          },
        }));
      if (operations.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await Cube.bulkWrite(operations);
      }
      console.log(`Finished: ${i + batchSize} of ${count} cubes`);
    }

    mongoose.disconnect();
    console.log('done');
  });
})();
