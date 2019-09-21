const aws = require('aws-sdk');
const fs = require('fs');
var util = require('./util.js');

var carddict = {};

const s3 = new aws.S3();

//read files
const data = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  full_names: [],
  cardFromId: function(id) {
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
  },
  getCardDetails: function(card) {
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
  },
  nameToId: {},
  normalizedName: card => card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(),
  allIds: card => data.nameToId[data.normalizedName(card)]
}

const files = [
  'carddict',
  'cardtree',
  'names',
  'nameToId',
  'full_names',
  'imagedict',
  'cardimages',
];

for (const file of files) {
  if (process.env.LAMBDA_TASK_ROOT) {
    // In an S3 Bucket
    s3.getObject({
      Bucket: process.env.CARDDB_BUCKET,
      Key: `${file}.json`,
    }, (err, response) => {
      if (err) {
        console.log(err);
        return;
      }

      data[file] = JSON.parse(response.Body);
    });
  } else {
    const path = `private/${file}.json`;
    fs.readFile(path, 'utf8', function(err, contents) {
      data[file] = JSON.parse(contents);
      console.log(`${file} loaded`);
    });
    fs.watchFile(path, (curr, prev) => {
      console.log(`File Changed: ${file}`);
      fs.readFile(path, 'utf8', function(err, contents) {
        data[file] = JSON.parse(contents);
        console.log(`${file} reloaded`);
      });
    });
  }
}

module.exports = data;
