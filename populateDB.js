const config = require('./config/database');
const mongoose =  require('mongoose');
const https = require('https');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, 'private', 'cards.json');

// Connect db
mongoose.connect(config.database);
let db = mongoose.connection;

let Card = require('./models/card')
let globalCounter = 0;

var x = 0;
var saveAllCards = function(arr)
{
  addCard(arr[x],function()
  {
    // set x to next item
    x++;

    // any more items in array? continue loop
    if(x < arr.length)
    {
        saveAllCards(arr);
    }
    else {
      console.log('done.' );
      process.exit();
    }
  });
}

function addCard(card,callback)
{
  Card.findOne({ id:card.id }, function (err, found)
  {
    if(found)
    {
      console.log(x + ' - ' + found.name + ' already exists');
      callback();
    }
    else
    {
      console.log(x + ' - adding: ' + card.name);
      let newcard = new Card();
      newcard.id = card.id;
      newcard.name = card.name;
      if(card.card_faces && card.card_faces[0].image_uris)
      {
        newcard.image_small = card.card_faces[0].image_uris.image_small;
        newcard.image_normal = card.card_faces[0].image_uris.image_normal;
        newcard.art_crop = card.card_faces[0].image_uris.art_crop;
      }
      else
      {
        newcard.image_small = card.image_uris.image_small;
        newcard.image_normal = card.image_uris.image_normal;
        newcard.art_crop = card.image_uris.art_crop;
      }
      newcard.cmc = card.cmc;
      newcard.type = card.type_line;
      newcard.colors = [];
      newcard.colors = newcard.colors.concat(card.colors);

      newcard.save(function(err)
      {
        callback();
      });
    }
  });
}

db.once('open', function()
{
  console.log('connected to nodecube db');

  const file = fs.createWriteStream(dir);
  const request = https.get("https://archive.scryfall.com/json/scryfall-default-cards.json", function(response)
  {
    let stream = response.pipe(file);
    stream.on('finish', function()
    {
      var contents = fs.readFileSync(dir);
      // Define to JSON type
      var cards = JSON.parse(contents);
      saveAllCards(cards);
    });
  });
});

// Check for db errors
db.on('error', function(err)
{
  console.log(err);
});
