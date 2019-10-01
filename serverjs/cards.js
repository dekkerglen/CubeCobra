const fs = require('fs');
var util = require('./util.js');

var data = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  full_names: [],
  nameToId: {},
  _carddict: {}
};
const loaded = {};
for (key of Object.keys(data)) {
  loaded[key] = false;
}
var fileToAttribute = {
  'carddict.json': '_carddict',
  'cardtree.json': 'cardtree',
  'names.json': 'cardnames',
  'nameToId.json': 'nameToId',
  'full_names.json': 'full_names',
  'imagedict.json': 'imagedict',
  'cardimages.json': 'cardimages'
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
    name_lower: 'Invalid Card',
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
    error: true
  };
}

function cardFromId(id) {
  if (data._carddict[id]) {
    return data._carddict[id];
  } else {
    console.log("Could not find: " + id);
    return getPlaceholderCard(id);
  }
}

function getCardDetails(card) {
  if (data._carddict[card.cardID]) {
    var details = data._carddict[card.cardID];
    card.details = details;
    details.display_image = util.getCardImageURL(card);
    return details;
  } else {
    console.log("Could not find: " + card.cardID);
    return getPlaceholderCard(card.cardID);
  };
}

function loadJSONFile(filename, attribute) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, 'utf8', function(err, contents) {
      data[attribute] = JSON.parse(contents);
      console.log(attribute + " loaded");
      if (err) {
        reject(err)
      } else {
        resolve(contents)
      }
    });
  });
}

function registerFileWatcher(filename, attribute) {
  fs.watchFile(filename, (curr, prev) => {
    console.log('File Changed: ' + filename);
    loadJSONFile(filename, attribute)
  });
}

function initializeCardDb(dataRoot, skipWatchers) {
  if ([...Object.values(loaded)].every(x => x)) {
    return Promise.resolve();
  }
  if (dataRoot === undefined) {
    dataRoot = "private";
  }
  const promises = [];
  for (const [filename, attribute] of Object.entries(fileToAttribute)) {
    if (process.env.LAMBDA_TASK_ROOT) {
      // In an S3 Bucket
      const promise = s3.getObject({
        Bucket: process.env.CARDDB_BUCKET,
        Key: filename,
      }).promise().then(response => {
        console.log('carddb: Initialized', attribute);
        data[attribute] = JSON.parse(response.Body);
        loaded[attribute] = true;
      }).catch(err => console.error(err));
      promises.push(promise);
    } else {
      filepath = dataRoot + '/' + filename;
      promises.push(loadJSONFile(filepath, attribute));
      if (skipWatchers !== true) {
        registerFileWatcher(filepath, attribute);
      }
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

data.cardFromId = cardFromId;
data.getCardDetails = getCardDetails;
data.normalizedName = card => card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
data.allIds = card => data.nameToId[data.normalizedName(card)];
data.initializeCardDb = initializeCardDb;
data.loadJSONFile = loadJSONFile;
data.getPlaceholderCard = getPlaceholderCard;
data.unloadCardDb = unloadCardDb;

module.exports = data;