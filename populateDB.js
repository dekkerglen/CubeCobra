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
    else
    {
      var cardtree = turnToTree(arr);

      fs.writeFile('private/cardtree.json', JSON.stringify(cardtree), 'utf8', function (err) {
          if (err) {
              console.log("An error occured while writing JSON Object to File.");
              return console.log(err);
          }

          console.log("JSON tree has been saved.");

          console.log('done.' );
          process.exit();
      });
    }
  });
}
function add_word(obj, word)
{
  if(word.length <= 0)
  {
    return;
  }
  else if(word.length == 1)
  {
    if(!obj[word.charAt(0)])
    {
      obj[word.charAt(0)] = {'$':{}};
    }
    else
    {
      obj[word.charAt(0)]['$']={};
    }
  }
  else
  {
    character = word.charAt(0);
    word = word.substr(1, word.length)
    if(!obj[character])
    {
      obj[character] = {};
    }
    add_word(obj[character], word)
  }
}
function turnToTree(arr)
{
  var res = {};
  arr.forEach(function (item, index)
  {
    //add_word(cardnames, card);
    add_word(res, item.name);
  });
  return res;
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
      if(card.name.includes('/') && card.layout!='split')
      {
        card.name = card.name.substring(0,card.name.indexOf('/')).trim();
      }
      console.log(x + ' - adding: ' + card.name);
      let newcard = new Card();
      newcard._id = card.id;
      newcard.full_name = card.name + ' [' + card.set + '-'+ card.collector_number + ']';
      newcard.name = card.name;
      newcard.name_lower = card.name.toLowerCase();
      if(card.card_faces && card.card_faces[0].image_uris)
      {
        newcard.image_small = card.card_faces[0].image_uris.small;
        newcard.image_normal = card.card_faces[0].image_uris.normal;
        newcard.art_crop = card.card_faces[0].image_uris.art_crop;
      }
      else
      {
        newcard.image_small = card.image_uris.small;
        newcard.image_normal = card.image_uris.normal;
        newcard.art_crop = card.image_uris.art_crop;
      }
      newcard.cmc = card.cmc;
      newcard.type = card.type_line;
      newcard.colors = [];

      if(card.colors)
      {
        newcard.colors = newcard.colors.concat(card.colors);
      }
      else if(!card.colors && card.card_faces[0].colors)
      {
        newcard.colors = newcard.colors.concat(card.card_faces[0].colors);
      }

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
