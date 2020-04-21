const winston = require('winston');
const cardutil = require('../dist/utils/Card.js');

const util = require('./util.js');
const carddb = require('./cards.js');

const catalog = {};

/* cardDetailsSchema = {
 *   color_identity: [Char],
 *   set: String,
 *   collector_number: String,
 *   promo: Boolean,
 *   digital: Boolean,
 *   isToken: Boolean,
 *   border_color: String,
 *   name: String,
 *   // normalized to lowercase
 *   name_lower: String,
 *   // name [set-collector_number]
 *   full_name: String,
 *   artist: String,
 *   // Url
 *   scryfall_uri: String,
 *   rarity: String,
 *   oracle_text: String,
 *   // Scryfall ID
 *   _id: UUID,
 *   oracle_id: String,
 *   cmc: Number
 *   legalities: {
 *     Legacy: Boolean,
 *     Modern: Boolean,
 *     Standard: Boolean,
 *     Pauper: Boolean,
 *     Pioneer: Boolean,
 *   },
 *   // Hybrid looks like w-u
 *   parsed_cost: [String],
 *   colors: [Char],
 *   type: String,
 *   full_art: Boolean,
 *   language: String,
 *   mtgo_id: String,
 *   tcgplayer_id: String,
 *   loyalty: UnsignedInteger
 *   power: Number
 *   toughness: Number
 *   // URL
 *   image_small: String
 *   // URL
 *   image_normal: String
 *   // URL
 *   art_crop: String
 *   // URL
 *   image_flip: String
 *   // Lowercase
 *   color_category: Char
 *   // Card ID's
 *   tokens: [UUID]
 */
function initializeCatalog() {
  catalog.dict = {};
  catalog.names = [];
  catalog.nameToId = {};
  catalog.full_names = [];
  catalog.imagedict = {};
  catalog.cardimages = {};
  catalog.oracleToId = {};
  catalog.english = {};
}

initializeCatalog();

function addCardToCatalog(card, isExtra) {
  catalog.dict[card._id] = card;
  const normalizedFullName = cardutil.normalizeName(card.full_name);
  const normalizedName = cardutil.normalizeName(card.name);
  catalog.imagedict[normalizedFullName] = {
    uri: card.art_crop,
    artist: card.artist,
  };
  if (isExtra !== true) {
    const cardImages = {
      image_normal: card.image_normal,
    };
    if (card.image_flip) {
      cardImages.image_flip = card.image_flip;
    }
    if (carddb.reasonableCard(card)) {
      catalog.cardimages[normalizedName] = cardImages;
    }
  }
  // only add if it doesn't exist, this makes the default the newest edition
  if (!catalog.nameToId[normalizedName]) {
    catalog.nameToId[normalizedName] = [];
  }
  catalog.nameToId[normalizedName].push(card._id);
  if (!catalog.oracleToId[card.oracle_id]) {
    catalog.oracleToId[card.oracle_id] = [];
  }
  catalog.oracleToId[card.oracle_id].push(card._id);
  util.binaryInsert(normalizedName, catalog.names);
  util.binaryInsert(normalizedFullName, catalog.full_names);
}

function writeFile(filepath, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filepath, data, 'utf8', (err) => {
      if (err) {
        winston.error(`An error occured while writing ${filepath}`, { error: err });
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function addLanguageMapping(card) {
  if (card.lang === 'en') {
    return;
  }

  const sameOracle = catalog.oracleToId[card.oracle_id] || [];
  for (const otherId of sameOracle) {
    const otherCard = catalog.dict[otherId];
    if (card.set === otherCard.set && card.collector_number === otherCard.collector_number) {
      catalog.english[card.id] = otherId;
      return;
    }
  }

  const name = cardutil.normalizeName(convertName(card));
  for (const otherId of catalog.nameToId[name]) {
    const otherCard = catalog.dict[otherId];
    if (card.set === otherCard.set && card.collector_number === otherCard.collector_number) {
      catalog.english[card.id] = otherId;
      return;
    }
  }
}

function writeCatalog(basePath = 'private') {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath);
  }
  const pendingWrites = [];
  pendingWrites.push(writeFile(path.join(basePath, 'names.json'), JSON.stringify(catalog.names)));
  pendingWrites.push(writeFile(path.join(basePath, 'cardtree.json'), JSON.stringify(util.turnToTree(catalog.names))));
  pendingWrites.push(writeFile(path.join(basePath, 'carddict.json'), JSON.stringify(catalog.dict)));
  pendingWrites.push(writeFile(path.join(basePath, 'nameToId.json'), JSON.stringify(catalog.nameToId)));
  pendingWrites.push(writeFile(path.join(basePath, 'english.json'), JSON.stringify(catalog.english)));
  pendingWrites.push(
    writeFile(path.join(basePath, 'full_names.json'), JSON.stringify(util.turnToTree(catalog.full_names))),
  );
  pendingWrites.push(writeFile(path.join(basePath, 'imagedict.json'), JSON.stringify(catalog.imagedict)));
  pendingWrites.push(writeFile(path.join(basePath, 'cardimages.json'), JSON.stringify(catalog.cardimages)));
  const allWritesPromise = Promise.all(pendingWrites);
  allWritesPromise.then(() => {
    winston.info('All JSON files saved.');
  });
  return allWritesPromise;
}

function saveEnglishCard(card) {
  if (card.layout === 'transform') {
    addCardToCatalog(convertCard(card, true), true);
  }
  addCardToCatalog(convertCard(card));
}

async function updateCardbase(basePath = 'private', defaultPath = null, allPath = null) {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath);
  }

  await downloadDefaultCards(basePath, defaultPath, allPath);

  winston.info('Updating cardbase, this might take a little while...');

  winston.info('Finished cardbase update...');
}

module.exports = {
  initializeCatalog,
  catalog,
  addCardToCatalog,
  addLanguageMapping,
  updateCardbase,
  downloadDefaultCards,
  saveAllCards,
  writeCatalog,
  convertCard,
  convertName,
  convertId,
  convertLegalities,
  convertType,
  convertColors,
  convertParsedCost,
  convertCmc,
  getTokens,
};
