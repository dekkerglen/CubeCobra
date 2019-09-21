var util = require('./util.js');
var carddb = require('./cards.js');
const fs = require('fs');
const https = require('https');

var dict = {};
var names = [];
var nameToId = {};
var full_names = [];
var imagedict = {};
var cardimages = {};


if (!fs.existsSync('private')) {
  fs.mkdirSync('private');
}

function downloadDefaultCards() {
  var file = fs.createWriteStream('private/cards.json');
  var promise = new Promise((resolve, reject) => {
    https.get("https://archive.scryfall.com/json/scryfall-default-cards.json", function(response) {
      let stream = response.pipe(file);
      stream.on('finish', function() {
        console.log("resolved");
        resolve();
      });
    })
  });
  return promise;
}

function updateCardbase(filepath) {
  if (filepath === undefined) {
    filepath = 'private/cards.json';
  }
  return module.exports.downloadDefaultCards().then(function() {
    console.log("Running save");
    var contents = fs.readFileSync(filepath);
    var cards = JSON.parse(contents);
    saveAllCards(cards);
    console.log("Finished cardbase update...");
  });
}

function addCardToCatalog(card, isExtra) {
  dict[card._id] = card;
  const normalizedFullName = card.full_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizedName = carddb.normalizedName(card);
  imagedict[normalizedFullName] = {
    uri: card.art_crop,
    artist: card.artist
  }
  if (isExtra !== true) {
    let card_images = {
      image_normal: card.image_normal
    };
    if (card.image_flip) {
      card_images.image_flip = card.image_flip;
    }
    cardimages[normalizedName] = card_images;
  }
  //only add if it doesn't exist, this makes the default the newest edition
  if (!nameToId[normalizedName]) {
    nameToId[normalizedName] = [];
  }
  nameToId[normalizedName].push(card._id);
  util.binaryInsert(normalizedName, names);
  util.binaryInsert(normalizedFullName, full_names);
}

function writeJSONFile(filepath, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filepath, data, 'utf8', function(err) {
      if (err) {
        console.log("An error occured while writing " + filepath);
        console.log(err);
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function saveAllCards(arr) {
  var normalizedName, normalizedFullName;
  arr.forEach(function(card, index) {
    if (card.layout == 'transform') {
      addCardToCatalog(convertExtraCard(card), true);
    }
    addCardToCatalog(convertCard(card));
  });
  var pendingWrites = [];
  pendingWrites.push(writeJSONFile('private/names.json', JSON.stringify(names)));
  pendingWrites.push(writeJSONFile('private/cardtree.json', JSON.stringify(util.turnToTree(names))));
  pendingWrites.push(writeJSONFile('private/carddict.json', JSON.stringify(dict)));
  pendingWrites.push(writeJSONFile('private/nameToId.json', JSON.stringify(nameToId)));
  pendingWrites.push(writeJSONFile('private/full_names.json', JSON.stringify(util.turnToTree(full_names))));
  pendingWrites.push(writeJSONFile('private/imagedict.json', JSON.stringify(imagedict)));
  pendingWrites.push(writeJSONFile('private/cardimages.json', JSON.stringify(cardimages)));
  var allWritesPromise = Promise.all(pendingWrites);
  allWritesPromise.then(function() {
    console.log("All JSON files saved.");
  })
  return allWritesPromise;
}

function convertExtraCard(card) {
  var name = card.name.substring(card.name.indexOf('/') + 2).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let newcard = {};
  newcard._id = card.id + '2';
  newcard.set = card.set;
  newcard.collector_number = card.collector_number;
  newcard.promo = card.promo;
  newcard.digital = card.digital;
  newcard.border_color = card.border_color;
  newcard.full_name = name + ' [' + card.set + '-' + card.collector_number + ']';
  newcard.name = name;
  newcard.name_lower = name.toLowerCase();
  newcard.artist = card.artist;
  newcard.scryfall_uri = card.scryfall_uri;
  newcard.rarity = card.rarity;
  newcard.oracle_text = card.oracle_text;
  newcard.legalities = {
    Legacy: false,
    Modern: false,
    Standard: false,
    Pauper: false,
  };
  if (card.tcgplayer_id) {
    newcard.tcgplayer_id = card.tcgplayer_id;
  }

  if (card.card_faces[1].loyalty) {
    newcard.loyalty = card.card_faces[1].loyalty;
  }
  if (card.card_faces[1].power) {
    newcard.power = card.card_faces[1].power;
  }
  if (card.card_faces[1].toughness) {
    newcard.toughness = card.card_faces[1].toughness;
  }
  newcard.image_small = card.card_faces[1].image_uris.small;
  newcard.image_normal = card.card_faces[1].image_uris.normal;
  newcard.art_crop = card.card_faces[1].image_uris.art_crop;
  newcard.cmc = 0;

  newcard.type = card.type_line.substring(card.type_line.indexOf('/') + 2).trim();
  newcard.colors = [];
  newcard.color_identity = [];

  newcard.color_identity = newcard.color_identity.concat(card.color_identity);
  newcard.parsed_cost = [];
  newcard.colors = newcard.colors.concat(card.card_faces[1].colors);

  if (newcard.type.toLowerCase().includes('land')) {
    newcard.colorcategory = 'l';
  } else if (newcard.color_identity.length == 0) {
    newcard.colorcategory = 'c';
  } else if (newcard.color_identity.length > 1) {
    newcard.colorcategory = 'm';
  } else if (newcard.color_identity.length == 1) {
    newcard.colorcategory = newcard.color_identity[0].toLowerCase();
  }

  return newcard;
}

function convertCard(card) {
  if (card.name.includes('/') && card.layout != 'split') {
    card.name = card.name.substring(0, card.name.indexOf('/')).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  let newcard = {};

  newcard._id = card.id;
  newcard.set = card.set;
  newcard.collector_number = card.collector_number;
  newcard.promo = card.promo;
  newcard.digital = card.digital;
  newcard.border_color = card.border_color;
  newcard.full_name = card.name + ' [' + card.set + '-' + card.collector_number + ']';
  newcard.name = card.name;
  newcard.name_lower = card.name.toLowerCase();
  newcard.artist = card.artist;
  newcard.scryfall_uri = card.scryfall_uri;
  newcard.rarity = card.rarity;
  newcard.legalities = {
    Legacy: card.legalities.legacy == 'legal',
    Modern: card.legalities.modern == 'legal',
    Standard: card.legalities.standard == 'legal',
    Pauper: card.legalities.pauper == 'legal'
  };
  newcard.oracle_text = card.oracle_text;
  if (card.tcgplayer_id) {
    newcard.tcgplayer_id = card.tcgplayer_id;
  }
  if (card.card_faces && card.card_faces[0].loyalty) {
    newcard.loyalty = card.card_faces[0].loyalty;
  } else if (card.loyalty) {
    newcard.loyalty = card.loyalty;
  }
  if (card.card_faces && card.card_faces[0].power) {
    newcard.power = card.card_faces[0].power;
  } else if (card.power) {
    newcard.power = card.power;
  }
  if (card.card_faces && card.card_faces[0].toughness) {
    newcard.toughness = card.card_faces[0].toughness;
  } else if (card.toughness) {
    newcard.toughness = card.toughness;
  }

  if (card.card_faces && card.card_faces[0].image_uris) {
    newcard.image_small = card.card_faces[0].image_uris.small;
    newcard.image_normal = card.card_faces[0].image_uris.normal;
    newcard.art_crop = card.card_faces[0].image_uris.art_crop;
    newcard.image_flip = card.card_faces[1].image_uris.normal;
  } else {
    newcard.image_small = card.image_uris.small;
    newcard.image_normal = card.image_uris.normal;
    newcard.art_crop = card.image_uris.art_crop;
  }
  newcard.cmc = card.cmc;
  if (card.type_line.includes('//')) {
    newcard.type = card.type_line.substring(0, card.type_line.indexOf('/'));
  } else {
    newcard.type = card.type_line;
  }
  if (newcard.type == 'Artifact — Contraption') {
    newcard.type = 'Artifact Contraption';
  }
  newcard.colors = [];
  newcard.color_identity = [];

  newcard.color_identity = newcard.color_identity.concat(card.color_identity);
  if (!card.card_faces || card.layout == 'flip') {
    newcard.colors = newcard.colors.concat(card.colors);
    newcard.parsed_cost = card.mana_cost.substr(1, card.mana_cost.length - 2).toLowerCase().split('}{').reverse();
  } else if (card.layout == 'split') {
    newcard.colors = newcard.colors.concat(card.colors);
    newcard.parsed_cost = card.mana_cost.substr(1, card.mana_cost.length - 2).replace(' // ', '{split}').toLowerCase().split('}{').reverse();
  } else if (card.card_faces[0].colors) {
    newcard.colors = newcard.colors.concat(card.card_faces[0].colors);
    newcard.parsed_cost = card.card_faces[0].mana_cost.substr(1, card.card_faces[0].mana_cost.length - 2).toLowerCase().split('}{').reverse();
  }

  if (newcard.parsed_cost) {
    newcard.parsed_cost.forEach(function(item, index) {
      newcard.parsed_cost[index] = item.replace('/', '-');
    });
  }
  if (newcard.type.toLowerCase().includes('land')) {
    newcard.colorcategory = 'l';
  } else if (newcard.color_identity.length == 0) {
    newcard.colorcategory = 'c';
  } else if (newcard.color_identity.length > 1) {
    newcard.colorcategory = 'm';
  } else if (newcard.color_identity.length == 1) {
    newcard.colorcategory = newcard.color_identity[0].toLowerCase();
  }

  return newcard;
}

module.exports = {
  updateCardbase: updateCardbase,
  downloadDefaultCards: downloadDefaultCards
};