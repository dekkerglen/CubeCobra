// node download_ratings.js https://cubecobra.com/tool/api/cardratings
const es = require('event-stream');
const fs = require('fs');
const https = require('https'); // eslint-disable-line import/no-extraneous-dependencies
const http = require('http');
const JSONStream = require('JSONStream');
const path = require('path'); // eslint-disable-line import/no-extraneous-dependencies

const CardRating = require('./models/cardrating.js');

function downloadFile(url, filePath) {
  const file = fs.createWriteStream(filePath);
  let provider = https;
  if (url.startsWith('http://')) {
    provider = http;
  }
  return new Promise((resolve) => {
    provider.get(url, (response) => {
      const stream = response.pipe(file);
      stream.on('finish', resolve);
    });
  });
}

async function downloadRatings(url, basePath = 'private', defaultPath = null) {
  return downloadFile(url, defaultPath || path.resolve(basePath, 'cardratings.json'));
}

async function saveCardRating(cardRating) {
  const existing = (await CardRating.findOne({ name: cardRating.name })) || new CardRating();
  existing.elo = cardRating.elo;
  existing.picks = cardRating.picks;
  existing.value = cardRating.value;
  await existing.save();
}

async function saveRatings(basePath = 'private', defaultPath = null) {
  await new Promise((resolve) =>
    fs
      .createReadStream(defaultPath || path.resolve(basePath, 'cards.json'))
      .pipe(JSONStream.parse('*'))
      .pipe(es.mapSync(saveCardRating))
      .on('close', resolve),
  );
}

downloadRatings(process.argv[2]);
saveRatings();
