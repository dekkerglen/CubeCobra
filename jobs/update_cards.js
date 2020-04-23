// Load Environment Variables
require('dotenv').config();

const fs = require('fs');
const path = require('path'); // eslint-disable-line import/no-extraneous-dependencies
const https = require('https'); // eslint-disable-line import/no-extraneous-dependencies
const mongoose = require('mongoose');
const Card = require('../models/card');
const { convertCard, isEquivalent, addToken } = require('./util');

const downloadFile = (url, filePath) => {
  const file = fs.createWriteStream(filePath);
  return new Promise((resolve) => {
    https.get(url, (response) => {
      const stream = response.pipe(file);
      stream.on('finish', resolve);
    });
  });
};

const downloadDefaultCards = async (basePath = 'private', defaultSourcePath = null, allSourcePath = null) => {
  const defaultUrl = 'https://archive.scryfall.com/json/scryfall-default-cards.json';
  const allUrl = 'https://archive.scryfall.com/json/scryfall-all-cards.json';
  return Promise.all([
    downloadFile(defaultUrl, defaultSourcePath || path.resolve(basePath, 'cards.json')),
    downloadFile(allUrl, allSourcePath || path.resolve(basePath, 'all-cards.json')),
  ]);
};

const saveCard = async (newcard) => {
  let card = await Card.findOne({ scryfall_id: newcard.scryfall_id });

  if (!card) {
    card = new Card();
  }

  // clear this field, we don't save it to DB
  delete newcard.scryfall_object;

  // this wil be true for a new card as well
  if (!isEquivalent(card, newcard)) {
    for (const key of Object.keys(newcard)) {
      card[key] = newcard[key];
    }
    await card.save();
  }
};

const saveEnglishCards = async (dict) => {
  await Promise.all(Object.keys(dict).map((key) => saveCard(dict[key])));
};

const addCard = (card, dict, nameToId) => {
  if (!nameToId[card.name_lower]) {
    nameToId[card.name_lower] = [];
  }
  nameToId[card.name_lower].push(card.scryfall_id);
  dict[card.scryfall_id] = card;
};

const processCard = async (card, dict, nameToId) => {
  if (card.layout === 'transform') {
    const extra = convertCard(card, true);
    addCard(extra, dict, nameToId);
  }
  const newcard = convertCard(card);
  addCard(newcard, dict, nameToId);
};

const addTokens = async (dict, nameToId) => {
  for (const key of Object.keys(dict)) {
    addToken(dict[key], dict, nameToId);
  }
};

async function saveAllCards(basePath = 'private') {
  const dict = {};
  const nameToId = {};

  const raw = JSON.parse(fs.readFileSync(path.resolve(basePath, 'cards.json')));

  for (let i = 0; i < raw.length; i++) {
    if (i % 100 === 0) {
      console.log(`processing ${i} of ${raw.length}`);
    }
    processCard(raw[i], dict, nameToId);
  }

  console.log(`Adding Tokens`);
  // add tokens mapping to card dict
  await addTokens(dict, nameToId);

  console.log(`Writing to DB`);
  // save card dict to db
  await saveEnglishCards(dict);

  // TODO: add language mapping mechanism
  /*
  console.log('Creating language mappings...');
  await new Promise((resolve) =>
    fs
      .createReadStream(allPath || path.resolve(basePath, 'all-cards.json'))
      .pipe(JSONStream.parse('*'))
      .pipe(es.mapSync(addLanguageMapping))
      .on('close', resolve),
  );
  */
}

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    console.log(`Download files`);
    await downloadDefaultCards();

    console.log(`Processing data`);
    await saveAllCards();

    console.log('done');
    process.exit();
  });
})();
