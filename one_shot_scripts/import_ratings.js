// node one_shot_scripts/import_ratings.js ../ratings.json
const es = require('event-stream');
const fs = require('fs');
const JSONStream = require('JSONStream');
const mongoose = require('mongoose');

const CardRating = require('../models/cardrating.js');

const mongosecrets = require('../../cubecobrasecrets/mongodb');

async function saveCardRating(cardRating) {
  const existing = (await CardRating.findOne({ name: cardRating.name })) || new CardRating();
  existing.name = cardRating.name;
  existing.elo = cardRating.elo;
  existing.picks = cardRating.picks;
  existing.value = cardRating.value;
  await existing.save();
  return existing;
}

async function saveRatings(defaultPath) {
  const ratings = JSON.parse(fs.readFileSync(defaultPath));
  return Promise.all(ratings.map(saveCardRating));
}

(async () => {
  mongoose.connect(mongosecrets.connectionString).then(async () => {
    await saveRatings(process.argv[2]);
    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
