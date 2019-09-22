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
  if (!fs.existsSync('private')) {
    fs.mkdirSync('private');
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

function writeFile(filepath, data) {
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
      addCardToCatalog(convertCard(card, true), true);
    }
    addCardToCatalog(convertCard(card));
  });
  var pendingWrites = [];
  pendingWrites.push(writeFile('private/names.json', JSON.stringify(names)));
  pendingWrites.push(writeFile('private/cardtree.json', JSON.stringify(util.turnToTree(names))));
  pendingWrites.push(writeFile('private/carddict.json', JSON.stringify(dict)));
  pendingWrites.push(writeFile('private/nameToId.json', JSON.stringify(nameToId)));
  pendingWrites.push(writeFile('private/full_names.json', JSON.stringify(util.turnToTree(full_names))));
  pendingWrites.push(writeFile('private/imagedict.json', JSON.stringify(imagedict)));
  pendingWrites.push(writeFile('private/cardimages.json', JSON.stringify(cardimages)));
  var allWritesPromise = Promise.all(pendingWrites);
  allWritesPromise.then(function() {
    console.log("All JSON files saved.");
  })
  return allWritesPromise;
}

function convertCard(card, isExtra) {
  var faceAttributeSource;
  let newcard = {};
  var name;
  newcard.colors = [];
  newcard.color_identity = [];
  newcard.color_identity = newcard.color_identity.concat(card.color_identity);
  if (isExtra) {
    faceAttributeSource = card.card_faces[1];
    name = card.name.substring(card.name.indexOf('/') + 2).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    newcard._id = card.id + '2';
    newcard.name_lower = name.toLowerCase();
    newcard.legalities = {
      Legacy: false,
      Modern: false,
      Standard: false,
      Pauper: false,
    };
    newcard.type = card.type_line.substring(card.type_line.indexOf('/') + 2).trim();
    newcard.parsed_cost = [];
    newcard.colors = newcard.colors.concat(card.card_faces[1].colors);
    newcard.cmc = 0;
  } else {
    if (card.card_faces) {
      faceAttributeSource = card.card_faces[0];
    } else {
      faceAttributeSource = card;
    }
    name = card.name;
    if (card.name.includes('/') && card.layout != 'split') {
      name = card.name.substring(0, card.name.indexOf('/')).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    newcard._id = card.id;
    newcard.name_lower = name.toLowerCase();
    newcard.legalities = {
      Legacy: card.legalities.legacy == 'legal',
      Modern: card.legalities.modern == 'legal',
      Standard: card.legalities.standard == 'legal',
      Pauper: card.legalities.pauper == 'legal'
    };
    if (card.type_line.includes('//')) {
      newcard.type = card.type_line.substring(0, card.type_line.indexOf('/'));
    } else {
      newcard.type = card.type_line;
    }
    if (newcard.type == 'Artifact — Contraption') {
      newcard.type = 'Artifact Contraption';
    }
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
    newcard.cmc = card.cmc;
  }
  newcard.set = card.set;
  newcard.collector_number = card.collector_number;
  newcard.promo = card.promo;
  newcard.digital = card.digital;
  newcard.border_color = card.border_color;
  newcard.name = name;
  newcard.full_name = name + ' [' + card.set + '-' + card.collector_number + ']';
  newcard.artist = card.artist;
  newcard.scryfall_uri = card.scryfall_uri;
  newcard.rarity = card.rarity;
  newcard.oracle_text = card.oracle_text;
  if (card.tcgplayer_id) {
    newcard.tcgplayer_id = card.tcgplayer_id;
  }
  if (faceAttributeSource.loyalty) {
    newcard.loyalty = faceAttributeSource.loyalty;
  }
  if (faceAttributeSource.power) {
    newcard.power = faceAttributeSource.power;
  }
  if (faceAttributeSource.toughness) {
    newcard.power = faceAttributeSource.toughness;
  }
  if (faceAttributeSource.image_uris) {
    newcard.image_small = faceAttributeSource.image_uris.small;
    newcard.image_normal = faceAttributeSource.image_uris.normal;
    newcard.art_crop = faceAttributeSource.image_uris.art_crop;
  } else {
    newcard.image_small = card.image_uris.small;
    newcard.image_normal = card.image_uris.normal;
    newcard.art_crop = card.image_uris.art_crop;
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