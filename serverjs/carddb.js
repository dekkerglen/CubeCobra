/* eslint-disable no-console */
const fs = require('fs');
const { winston } = require('./cloudwatch');

const { SortFunctions } = require('../dist/utils/Sort');

let data = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  full_names: [],
  nameToId: {},
  oracleToId: {},
  english: {},
  _carddict: {},
  printedCardList: [], // for card filters
};

const fileToAttribute = {
  'carddict.json': '_carddict',
  'cardtree.json': 'cardtree',
  'names.json': 'cardnames',
  'nameToId.json': 'nameToId',
  'oracleToId.json': 'oracleToId',
  'full_names.json': 'full_names',
  'imagedict.json': 'imagedict',
  'cardimages.json': 'cardimages',
  'english.json': 'english',
};

function getPlaceholderCard(_id) {
  // placeholder card if we don't find the one due to a scryfall ID update bug
  return {
    _id,
    set: '',
    collector_number: '',
    promo: false,
    reprint: false,
    digital: false,
    full_name: 'Invalid Card',
    name: 'Invalid Card',
    name_lower: 'invalid card',
    artist: '',
    scryfall_uri: '',
    rarity: '',
    legalities: {},
    oracle_text: '',
    image_normal: 'https://img.scryfall.com/errors/missing.jpg',
    cmc: 0,
    type: '',
    colors: [],
    color_identity: [],
    parsed_cost: [],
    colorcategory: 'c',
    error: true,
  };
}

function cardFromId(id, fields) {
  let details;
  if (data._carddict[id]) {
    details = data._carddict[id];
  } else {
    // TODO: replace this back with error. it was clogging the logs.
    // console.log(null, { error: new Error(`Could not find card from id: ${JSON.stringify(id, null, 2)}`) });
    details = getPlaceholderCard(id);
  }

  if (!fields) {
    return details;
  }
  if (!Array.isArray(fields)) {
    fields = fields.split(' ');
  }

  return Object.fromEntries(fields.map((field) => [field, details[field]]));
}

function getCardDetails(card) {
  if (data._carddict[card.cardID]) {
    const details = data._carddict[card.cardID];
    card.details = details;
    return details;
  }
  winston.error(null, { error: new Error(`Could not find card details: ${card.cardID}`) });
  return getPlaceholderCard(card.cardID);
}

async function loadJSONFile(filename, attribute) {
  try {
    data[attribute] = JSON.parse(await fs.promises.readFile(filename, 'utf8'));
    console.log(`Loaded ${filename}.`);
  } catch (e) {
    console.error(`Error loading ${filename}.`, { error: e });
  }
}

function registerFileWatcher(filename, attribute) {
  fs.watchFile(filename, () => {
    console.log(`File Changed: ${filename}`);
    loadJSONFile(filename, attribute);
  });
}

async function initializeCardDb() {
  console.log('Loading carddb...');

  await Promise.all(
    Object.entries(fileToAttribute).map(([filename, attribute]) => loadJSONFile(`private/${filename}`, attribute)),
  );

  for (const [filename, attribute] of Object.entries(fileToAttribute)) {
    registerFileWatcher(`private/${filename}`, attribute);
  }

  data.printedCardList = Object.values(data._carddict).filter((card) => !card.digital && !card.isToken);

  console.log('Finished loading carddb.');
}

function unloadCardDb() {
  for (const [filename, attribute] of Object.entries(fileToAttribute)) {
    delete data[attribute];
    try {
      fs.unwatchFile(filename);
    } catch (e) {
      // This is likely just because we didn't register them.
      winston.warn(null, { error: new Error(`Failed to unwatch file ${filename}.`) });
    }
  }
  delete data.printedCardList;
}

function reasonableCard(card) {
  return (
    !card.promo &&
    !card.digital &&
    !card.isToken &&
    card.border_color !== 'gold' &&
    card.language === 'en' &&
    card.tcgplayer_id &&
    card.set !== 'myb' &&
    card.set !== 'mb1' &&
    card.collector_number.indexOf('★') === -1 &&
    card.layout !== 'art_series'
  );
}

function reasonableId(id) {
  return reasonableCard(cardFromId(id));
}

function getIdsFromName(name) {
  // this is a fully-spcecified card name
  if (name.includes('[') && name.includes(']')) {
    name = name.toLowerCase();
    const split = name.split('[');
    return getIdsFromName(split[0])
      .map((id) => cardFromId(id))
      .filter((card) => card.full_name.toLowerCase() === name)
      .map((card) => card._id);
  }

  return data.nameToId[
    name
      .trim()
      .normalize('NFD') // convert to consistent unicode format
      .replace(/[\u0300-\u036f]/g, '') // remove unicode
      .toLowerCase()
  ];
}

// Printing = 'recent' or 'first'
function getMostReasonable(cardName, printing = 'recent', filter = null) {
  let ids = getIdsFromName(cardName);
  if (ids === undefined || ids.length === 0) {
    // Try getting it by ID in case this is an ID.
    // eslint-disable-next-line no-use-before-define
    return getMostReasonableById(cardName, printing);
  }

  if (filter) {
    ids = ids
      .map((id) => ({ details: cardFromId(id) }))
      .filter(filter)
      .map((card) => card.details._id);
  }

  if (ids.length === 0) {
    return null;
  }

  // sort chronologically by default
  const cards = ids.map((id) => ({
    details: cardFromId(id),
  }));
  cards.sort((a, b) => {
    const dateCompare = SortFunctions['Release date'](a, b);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return SortFunctions['Collector number'](a, b);
  });

  ids = cards.map((card) => card.details._id);

  // Ids are stored in reverse chronological order, so reverse if we want first printing.
  if (printing !== 'recent') {
    ids = [...ids];
    ids.reverse();
  }

  return cardFromId(ids.find(reasonableId) || ids[0]);
}

function getMostReasonableById(id, printing = 'recent', filter = null) {
  const card = cardFromId(id);
  if (card.error) {
    console.log(`Error finding most reasonable for id ${id}`);
    return null;
  }
  return getMostReasonable(card.name, printing, filter);
}

function getFirstReasonable(ids) {
  return cardFromId(ids.find(reasonableId) || ids[0]);
}

function getEnglishVersion(id) {
  return data.english[id];
}

function getVersionsByOracleId(oracleId) {
  return data.oracleToId[oracleId];
}

data = {
  ...data,
  cardFromId,
  getCardDetails,
  getIdsFromName,
  getEnglishVersion,
  getVersionsByOracleId,
  allVersions: (card) => getIdsFromName(card.name),
  allCards: () => Object.values(data._carddict),
  allOracleIds: () => Object.keys(data.oracleToId),
  initializeCardDb,
  loadJSONFile,
  getPlaceholderCard,
  unloadCardDb,
  getMostReasonable,
  getMostReasonableById,
  getFirstReasonable,
  reasonableId,
  reasonableCard,
  normalizedName: (card) => card.name_lower,
  fileToAttribute,
};

module.exports = data;
