// node one_shot_scripts/import_ratings.js ../ratings.json
const es = require('event-stream');
const fs = require('fs');
const JSONStream = require('JSONStream');

const CardRating = require('../models/cardrating.js');

async function saveCardRating(cardRating) {
  const existing = (await CardRating.findOne({ name: cardRating.name })) || new CardRating();
  existing.name = cardRating.name;
  existing.elo = cardRating.elo;
  existing.picks = cardRating.picks;
  existing.value = cardRating.value;
  await existing.save();
}

async function saveRatings(defaultPath = null) {
  await new Promise((resolve) =>
    fs
      .createReadStream(defaultPath)
      .pipe(JSONStream.parse('*'))
      .pipe(es.mapSync(saveCardRating))
      .on('close', resolve),
  );
}

saveRatings(process.argv[2]);
