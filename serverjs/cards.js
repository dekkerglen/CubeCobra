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
    console.log('File Changed: imagedict');
    loadJSONFile(filename, attribute)
  });
}

function initializeCardDb(dataRoot) {
  if (dataRoot === undefined) {
    dataRoot = "private";
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
  var promises = [],
    filepath, attribute;
  for (var filename in fileToAttribute) {
    filepath = dataRoot + '/' + filename;
    attribute = fileToAttribute[filename];
    promises.push(loadJSONFile(filepath, attribute));
    registerFileWatcher(filepath, attribute);
  }
  return Promise.all(promises);
}

data.cardFromId = cardFromId;
data.getCardDetails = getCardDetails;
data.normalizedName = card => card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
data.allIds = card => data.nameToId[data.normalizedName(card)];
data.initializeCardDb = initializeCardDb;
data.loadJSONFile = loadJSONFile;
data.getPlaceholderCard = getPlaceholderCard;

module.exports = data;