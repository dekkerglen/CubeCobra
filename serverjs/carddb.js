/* eslint-disable no-console */
const fs = require('fs');
const json = require('big-json');

const { SortFunctions } = require('../dist/utils/Sort');
const { filterCardsDetails } = require('../dist/filtering/FilterCards');

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
  indexToOracle: [],
  metadatadict: {},
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
  'indexToOracle.json': 'indexToOracle',
  'metadatadict.json': 'metadatadict',
};

// eslint-disable-next-line camelcase
function getPlaceholderCard(scryfall_id) {
  // placeholder card if we don't find the one due to a scryfall ID update bug
  return {
    scryfall_id,
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
  return getPlaceholderCard(card.cardID);
}

async function loadJSONFile(filename, attribute) {
  return new Promise((resolve, reject) => {
    try {
      const readStream = fs.createReadStream(filename);
      const parseStream = json.createParseStream();

      parseStream.on('data', (parsed) => {
        data[attribute] = parsed;
      });

      readStream.pipe(parseStream);

      readStream.on('end', () => {
        console.info(`Loaded ${filename}.`);
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function loadAllFiles() {
  await Promise.all(
    Object.entries(fileToAttribute).map(([filename, attribute]) => loadJSONFile(`private/${filename}`, attribute)),
  );
}

async function initializeCardDb() {
  console.info('Loading carddb...');
  await loadAllFiles();

  data.printedCardList = Object.values(data._carddict).filter((card) => !card.digital && !card.isToken);

  console.info('Finished loading carddb.');
}

function reasonableCard(card) {
  return (
    !card.isExtra &&
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

function getNameForComparison(name) {
  return name
    .trim()
    .normalize('NFD') // convert to consistent unicode format
    .replace(/[\u0300-\u036f]/g, '') // remove unicode
    .toLowerCase();
}

function getIdsFromName(name) {
  // this is a fully-spcecified card name
  if (name.includes('[') && name.includes(']')) {
    name = name.toLowerCase();
    const split = name.split('[');
    return getIdsFromName(split[0])
      .map((id) => cardFromId(id))
      .filter((card) => getNameForComparison(card.full_name) === getNameForComparison(name))
      .map((card) => card.scryfall_id);
  }

  return data.nameToId[getNameForComparison(name)];
}

// Printing = 'recent' or 'first'
function getMostReasonable(cardName, printing = 'recent', filter = null) {
  let ids = getIdsFromName(cardName);
  if (ids === undefined || ids.length === 0) {
    // Try getting it by ID in case this is an ID.
     
    return getMostReasonableById(cardName, printing);
  }

  if (filter) {
    ids = ids
      .map((id) => ({ details: cardFromId(id) }))
      .filter(filter)
      .map((card) => card.details.scryfall_id);
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

  ids = cards.map((card) => card.details.scryfall_id);

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

const getReasonableCardByOracle = (oracleId) => {
  const ids = data.oracleToId[oracleId];
  return getFirstReasonable(ids);
};

function isOracleBasic(oracleId) {
  return cardFromId(data.oracleToId[oracleId][0]).type.includes('Basic');
}

function getRelatedCards(oracleId) {
  const related = data.metadatadict[oracleId];

  if (!related) {
    return {
      cubedWith: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
      draftedWith: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
      synergistic: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
    };
  }

  return Object.fromEntries(
    Object.entries(related).map(([label, category]) => [
      label,
      Object.fromEntries(
        Object.entries(category).map(([type, indexes]) => [type, indexes.map((id) => data.indexToOracle[id])]),
      ),
    ]),
  );
}

const getAllMostReasonable = (filter) => {
  const cards = filterCardsDetails(data.printedCardList, filter);

  const keys = new Set();
  const filtered = [];
  for (const card of cards) {
    if (!keys.has(card.name_lower)) {
      filtered.push(getMostReasonableById(card.scryfall_id, 'recent', filter));
      keys.add(card.name_lower);
    }
  }
  return filtered;
};

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
  getMostReasonable,
  getMostReasonableById,
  getFirstReasonable,
  reasonableId,
  reasonableCard,
  normalizedName: (card) => card.name_lower,
  fileToAttribute,
  loadAllFiles,
  isOracleBasic,
  getReasonableCardByOracle,
  getRelatedCards,
  getAllMostReasonable,
};

module.exports = data;
