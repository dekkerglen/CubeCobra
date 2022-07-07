// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Cube = require('../models/cube');
const Article = require('../models/article');
const Comment = require('../models/comment');
const User = require('../models/user');

const batchSize = 100;

async function fixImage(doc, prop) {
  // only urls from the img.* subdomain are invalid
  if (!doc[prop].startsWith('https://img.scryfall.com')) return;

  doc[prop] = doc[prop].replace('https://img.scryfall.com/cards', 'https://c1.scryfall.com/file/scryfall-cards');
  await doc.save();
}

const documents = {
  Article: [Article, 'image'],
  Comment: [Comment, 'image'],
  Cube: [Cube, 'image_uri'],
  User: [User, 'image'],
};

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    for (const [name, value] of Object.entries(documents)) {
      console.log(`Processing ${name}s...`);
      const [Collection, prop] = value;
      const count = await Collection.countDocuments();
      const cursor = Collection.find().cursor();

      // batch them by batchSize
      for (let i = 0; i < count; i += batchSize) {
        const docs = [];
        for (let j = 0; j < batchSize; j++) {
          try {
            if (i + j < count) {
              const doc = await cursor.next();
              if (doc) {
                docs.push(doc);
              }
            }
          } catch (err) {
            console.debug(err);
          }
        }
        await Promise.all(docs.map((doc) => fixImage(doc, prop)));
        console.log(`Finished: ${i} of ${count} ${name}s`);
      }
      console.log(`Done with ${name}s`);
    }
    await mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
