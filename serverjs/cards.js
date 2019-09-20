const fs = require('fs');
var util = require('./util.js');

var carddict = {};
var data = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  full_names: [],
  nameToId: {}
};

function cardFromId(id) {
  if (carddict[id]) {
    return carddict[id];
  } else {
    console.log("Could not find: " + id);
    //placeholder card if we don't find the one due to a scryfall ID update bug
    return {
      // img: 
      _id: id,
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
}

function getCardDetails(card) {
  if (carddict[card.cardID]) {
    var details = carddict[card.cardID];
    card.details = details;
    details.display_image = util.getCardImageURL(card);
    return details;
  } else {
    console.log("Could not find: " + id);
    //placeholder card if we don't find the one due to a scryfall ID update bug
    return {
      // img: 
      _id: id,
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
}

function initializeCardDb(dataRoot) {
  if (dataRoot === undefined) {
    dataRoot = "private";
  }
  fs.readFile(dataRoot + '/carddict.json', 'utf8', function(err, contents) {
    carddict = JSON.parse(contents);
    console.log("carddict loaded");
  });
  fs.readFile(dataRoot + '/cardtree.json', 'utf8', function(err, contents) {
    data.cardtree = JSON.parse(contents);
    console.log("cardtree loaded");
  });
  fs.readFile(dataRoot + '/names.json', 'utf8', function(err, contents) {
    data.cardnames = JSON.parse(contents);
    console.log("names loaded");
  });
  fs.readFile(dataRoot + '/nameToId.json', 'utf8', function(err, contents) {
    data.nameToId = JSON.parse(contents);
    console.log("nameToId loaded");
  });
  fs.readFile(dataRoot + '/full_names.json', 'utf8', function(err, contents) {
    data.full_names = JSON.parse(contents);
    console.log("full_names loaded");
  });
  fs.readFile(dataRoot + '/imagedict.json', 'utf8', function(err, contents) {
    data.imagedict = JSON.parse(contents);
    console.log("imagedict loaded");
  });
  fs.watchFile(dataRoot + '/imagedict.json', (curr, prev) => {
    console.log('File Changed: imagedict');
    fs.readFile(dataRoot + '/imagedict.json', 'utf8', function(err, contents) {
      data.imagedict = JSON.parse(contents);
      console.log("imagedict reloaded");
    });
  });
  fs.readFile(dataRoot + '/cardimages.json', 'utf8', function(err, contents) {
    data.cardimages = JSON.parse(contents);
    console.log("cardimages loaded");
  });
  fs.watchFile(dataRoot + '/cardimages.json', (curr, prev) => {
    console.log('File Changed: cardimages');
    fs.readFile(dataRoot + '/cardimages.json', 'utf8', function(err, contents) {
      data.cardimages = JSON.parse(contents);
      console.log("cardimages reloaded");
    });
  });
  fs.watchFile(dataRoot + '/cardtree.json', (curr, prev) => {
    console.log('File Changed: cardtree');
    fs.readFile(dataRoot + '/cardtree.json', 'utf8', function(err, contents) {
      data.cardtree = JSON.parse(contents);
      console.log("cardtree reloaded");
    });
  });
  fs.watchFile(dataRoot + '/names.json', (curr, prev) => {
    console.log('File Changed: names');
    fs.readFile(dataRoot + '/names.json', 'utf8', function(err, contents) {
      data.cardnames = JSON.parse(contents);
      console.log("names reloaded");
    });
  });
  fs.watchFile(dataRoot + '/carddict.json', (curr, prev) => {
    console.log('File Changed: carddict');
    fs.readFile(dataRoot + '/carddict.json', 'utf8', function(err, contents) {
      carddict = JSON.parse(contents);
      console.log("carddict reloaded");
    });
  });
  fs.watchFile(dataRoot + '/nameToId.json', (curr, prev) => {
    console.log('File Changed: nameToId');
    fs.readFile(dataRoot + '/nameToId.json', 'utf8', function(err, contents) {
      data.nameToId = JSON.parse(contents);
      console.log("nameToId reloaded");
    });
  });
  fs.watchFile(dataRoot + '/full_names.json', (curr, prev) => {
    console.log('File Changed: full_names');
    fs.readFile(dataRoot + '/full_names.json', 'utf8', function(err, contents) {
      data.full_names = JSON.parse(contents);
      console.log("full_names reloaded");
    });
  });
}

data.cardFromId = cardFromId;
data.getCardDetails = getCardDetails;
data.normalizedName = card => card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
data.allIds = card => data.nameToId[data.normalizedName(card)];
data.initializeCardDb = initializeCardDb;

module.exports = data;