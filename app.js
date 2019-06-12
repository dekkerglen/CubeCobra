const express = require('express');
const path = require('path');
const mongoose =  require('mongoose');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
const config = require('./config/database');
var schedule = require('node-schedule');
const http = require('http');
const fs = require('fs');
const https = require('https');
var fileUpload  = require('express-fileupload');

// Connect db
mongoose.connect(config.database);
let db = mongoose.connection;
db.once('open', function()
{
  console.log('connected to nodecube db');
});

// Check for db errors
db.on('error', function(err)
{
  console.log(err);
});

// Init app
const app = express();

// Bring in models
let Cube = require('./models/cube')

//upload file middleware
app.use(fileUpload());

// Body parser middleware
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

//Load view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Set Public Folder
app.use(express.static(path.join(__dirname,'public')));




// Express session middleware
app.use(session({
  secret:'vertical donkey gatorade helicopter',
  resave: false,
  saveUninitialized: true,
  cooke: {secure: true}
}));

//Express messages middleware
app.use(require('connect-flash')());
app.use(function (req, res, next) {
  res.locals.messages = require('express-messages')(req, res);
  next();
});

// Express validator middleware
app.use(expressValidator({
  errorFormatter: function(param, msg, value){
    var namespace = param.split('.'),
    root = namespace.shift(),
    formParam = root;

    while(namespace.length)
    {
      formParam += '[' + namespace.shift() + ']';
    }
    return {
      param: formParam,
      msg: msg,
      value: value
    };
  }
}));

// Passport config and middleware
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

app.get('*', function(req, res, next)
{
  res.locals.user = req.user || null;
  next();
});

// Home route
app.get('/', function(req, res)
{
  Cube.find({}, function(err, cubes)
  {
    res.render('index',
    {
      title:'Home',
      cubes: cubes
    });
  });
});
app.get('/search', function(req, res)
{
  res.render('search', {});
});

app.get('/browse', function(req, res)
{
  res.render('browse', {});
});
app.get('/faq', function(req, res)
{
  res.render('faq', {});
});
app.get('/blog', function(req, res)
{
  res.render('blog', {});
});
app.get('/contact', function(req, res)
{
  res.render('contact', {});
});

//Route files
let cubes =  require('./routes/cube_routes');
let users =  require('./routes/users_routes');
app.use('/cube', cubes);
app.use('/user', users);


var dict = {};
var names = [];
var nameToId = {};
schedule.scheduleJob('0 0 * * *', function(){
  console.log("Starting midnight cardbase update...");

  dict = {};
  names = [];
  nameToId = {};

  var file = fs.createWriteStream('private/cards.json');
  var request = https.get("https://archive.scryfall.com/json/scryfall-default-cards.json", function(response)
  {
    let stream = response.pipe(file);
    stream.on('finish', function()
    {
      var contents = fs.readFileSync('private/cards.json');
      // Define to JSON type
      var cards = JSON.parse(contents);
      saveAllCards(cards);
      console.log("Finished cardbase update...");
    });
  });
});

function saveAllCards(arr)
{
  arr.forEach(function(card, index)
  {
    card = convertCard(card);
    dict[card._id]=card;
    //only add if it doesn't exist, this makes the default the newest edition
    if(!nameToId[card.name.toLowerCase()])
    {
      nameToId[card.name.toLowerCase()]=card._id;
    }
    binaryInsert(card.name.toLowerCase(), names);
  });
  fs.writeFile('private/names.json', JSON.stringify(names), 'utf8', function (err)
  {
      if (err)
      {
          console.log("An error occured while writing names.json");
          return console.log(err);
      }
      var cardtree = turnToTree(names);

      fs.writeFile('private/cardtree.json', JSON.stringify(cardtree), 'utf8', function (err)
      {
          if (err)
          {
              console.log("An error occured while writing cardtree.json");
              return console.log(err);
          }
          fs.writeFile('private/carddict.json', JSON.stringify(dict), 'utf8', function (err)
          {
              if (err)
              {
                  console.log("An error occured while writing carddict.json");
                  return console.log(err);
              }
              fs.writeFile('private/nameToId.json', JSON.stringify(nameToId), 'utf8', function (err)
              {
                  if (err)
                  {
                      console.log("An error occured while writing nametToId.json");
                      return console.log(err);
                  }

                  console.log("All JSON files saved.");
              });
          });
      });
  });
}

function binaryInsert(value, array, startVal, endVal)
{
  var length = array.length;
  var start = typeof(startVal) != 'undefined' ? startVal : 0;
  var end = typeof(endVal) != 'undefined' ? endVal : length - 1;//!! endVal could be 0 don't use || syntax
  var m = start + Math.floor((end - start)/2);

  if(length == 0){
    array.push(value);
    return;
  }

  if(value > array[end]){
    array.splice(end + 1, 0, value);
    return;
  }

  if(value < array[start]){//!!
    array.splice(start, 0, value);
    return;
  }

  if(start >= end){
    return;
  }

  if(value < array[m]){
    binaryInsert(value, array, start, m - 1);
    return;
  }

  if(value > array[m]){
    binaryInsert(value, array, m + 1, end);
    return;
  }

  //we don't insert duplicates
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
    add_word(res, item);
  });
  return res;
}

function convertCard(card)
{
  if(card.name.includes('/') && card.layout!='split')
  {
    card.name = card.name.substring(0,card.name.indexOf('/')).trim();
  }
  let newcard = {};
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
  return newcard;
}

// Start server
http.createServer(app).listen(5000,'localhost', function()
{
  console.log('server started on port 5000...');
});
