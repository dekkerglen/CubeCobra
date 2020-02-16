const fs = require('fs');
const util = require('./util.js');
const cardutil = require('../dist/utils/Card.js');

var data = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  full_names: [],
  nameToId: {},
  english: {},
  _carddict: {},
};
var fileToAttribute = {
  'carddict.json': '_carddict',
  'cardtree.json': 'cardtree',
  'names.json': 'cardnames',
  'nameToId.json': 'nameToId',
  'full_names.json': 'full_names',
  'imagedict.json': 'imagedict',
  'cardimages.json': 'cardimages',
  'english.json': 'english',
};

function getPlaceholderCard(_id) {
  //placeholder card if we don't find the one due to a scryfall ID update bug
  return {
    _id: _id,
    set: '',
    collector_number: '',
    promo: false,
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
    console.log('Could not find card from id: ');
    console.log(id);
    details = getPlaceholderCard(id);
  }

  if (typeof fields === 'undefined') {
    return details;
  } else if (!Array.isArray(fields)) {
    fields = fields.split(' ');
  }

  return util.fromEntries(fields.map((field) => [field, details[field]]));
}

function getCardDetails(card) {
  if (data._carddict[card.cardID]) {
    var details = data._carddict[card.cardID];
    card.details = details;
    return details;
  } else {
    console.log('Could not find card details: ' + card.cardID);
    return getPlaceholderCard(card.cardID);
  }
}

function loadJSONFile(filename, attribute) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, 'utf8', function(err, contents) {
      if (!err) {
        try {
          data[attribute] = JSON.parse(contents);
        } catch (e) {
          console.log('Error parsing json from ', filename, ' : ', e);
          err = e;
        }
        console.log(attribute + ' loaded');
      }
      if (err) {
        reject(err);
      } else {
        resolve(contents);
      }
    });
  });
}

function registerFileWatcher(filename, attribute) {
  fs.watchFile(filename, (curr, prev) => {
    console.log('File Changed: ' + filename);
    loadJSONFile(filename, attribute);
  });
}

function initializeCardDb(dataRoot, skipWatchers) {
  if (dataRoot === undefined) {
    dataRoot = 'private';
  }
  var promises = [],
    filepath,
    attribute;
  for (var filename in fileToAttribute) {
    filepath = dataRoot + '/' + filename;
    attribute = fileToAttribute[filename];
    promises.push(loadJSONFile(filepath, attribute));
    if (skipWatchers !== true) {
      registerFileWatcher(filepath, attribute);
    }
  }
  return Promise.all(promises);
}

function unloadCardDb() {
  var attribute;
  for (var filename in fileToAttribute) {
    attribute = fileToAttribute[filename];
    delete data[attribute];
  }
}

function reasonableCard(card) {
  return (
    !card.promo &&
    !card.digital &&
    card.border_color !== 'gold' &&
    card.language === 'en' &&
    card.tcgplayer_id &&
    card.set !== 'myb'
  );
}

function reasonableId(id) {
  return reasonableCard(cardFromId(id));
}

function getIdsFromName(name) {
  return data.nameToId[cardutil.normalizeName(name)];
}

// Printing = 'recent' or 'first'
function getMostReasonable(cardName, printing = 'recent') {
  const ids = [...getIdsFromName(cardName)];
  if (typeof ids === 'undefined' || ids.length === 0) {
    // eslint-disable-next-line no-use-before-define
    return getMostReasonableById(cardName, printing);
  }

  // Ids are stored in reverse chronological order, so reverse if we want first printing.
  if (printing !== 'recent') {
    ids.reverse();
  }
  return cardFromId(ids.find(reasonableId) || ids[0]);
}

function getMostReasonableById(id, printing = 'recent') {
  const card = cardFromId(id);
  if (card.error) {
    console.log('Error finding most reasonable for id:', id);
    return getPlaceholderCard(0);
  }
  return getMostReasonable(card.name, printing);
}

function getEnglishVersion(id) {
  return data.english[id];
}

data.cardFromId = cardFromId;
data.getCardDetails = getCardDetails;
data.getIdsFromName = getIdsFromName;
data.getEnglishVersion = getEnglishVersion;
data.allIds = (card) => getIdsFromName(card.name);
data.allCards = () => Object.values(data._carddict);
data.initializeCardDb = initializeCardDb;
data.loadJSONFile = loadJSONFile;
data.getPlaceholderCard = getPlaceholderCard;
data.unloadCardDb = unloadCardDb;
data.getMostReasonable = getMostReasonable;
data.getMostReasonableById = getMostReasonableById;
data.reasonableId = reasonableId;
data.reasonableCard = reasonableCard;

// deprecated: use card.name_lower or cardutil.normalizeName
data.normalizedName = (card) => cardutil.normalizeName(card.name);

module.exports = data;
