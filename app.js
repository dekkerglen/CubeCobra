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
let User = require('./models/user')
let Blog = require('./models/blog')
let Deck = require('./models/deck')

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
  Cube.find().sort({'date_updated': -1}).limit(12).exec(function(err, recents)
  {
    Cube.find().sort({'numDecks': -1}).limit(12).exec(function(err, drafted)
    {
      Blog.find({dev:'true'}).sort({'date': -1}).exec(function(err, blog)
      {
        Deck.find().sort({'date': -1}).limit(10).exec(function(err, decks)
        {
          decklinks = decks.splice(Math.max(decks.length - 10, 0), decks.length);
          res.render('index',
          {
            devblog:blog[0],
            recents:recents,
            drafted:drafted,
            decks:decklinks
          });
        });
      });
    });
  });
});


//format: {search};{search};{search}:{page}
//list like:
//{property}{symbol}{value};
//properties:
//name, owner
//symbols:
//=,~(contains)

app.get('/advanced_search', function(req, res)
{
  res.render('advanced_search',
  {
    loginCallback:'/advanced_search'
  });
});

app.post('/advanced_search', function(req, res)
{
  var url = '/search/';
  if(req.body.name && req.body.name.length > 0)
  {
    url += 'name' + req.body.nameType + req.body.name + ';';
  }
  if(req.body.owner && req.body.owner.length > 0)
  {
    url += 'owner_name' + req.body.ownerType + req.body.owner + ';';
  }
  res.redirect(url)
});

app.post('/search', function(req, res)
{
  if(!req.body.search || req.body.search.length == 0)
  {
    req.flash('danger', 'No Search Parameters');
    res.redirect('/advanced_search');
  }
  else
  {
    var query = req.body.search;
    if(query.includes(';'))
    {
      res.redirect('/search/'+query)
    }
    else
    {
      res.redirect('/search/name~'+query);
    }
  }
});


app.get('/search/:id', function(req, res)
{
  var raw_split = req.params.id.split(':');
  var raw_queries = raw_split[0].split(';');
  var page = parseInt(raw_split[1]);
  var query = {};
  var terms = [];
  raw_queries.forEach(function(val, index)
  {
    if(val.includes('='))
    {
      var split = val.split('=');
      query[split[0]] = split[1];
      terms.push(split[0].replace('owner_name','owner') + ' is exactly ' + split[1]);
    }
    else if(val.includes('~'))
    {
      var split = val.split('~');
      query[split[0]] = {
        "$regex":split[1],
        "$options":"i"
      };
      terms.push(split[0].replace('owner_name','owner') + ' contains ' + split[1]);
    }
  });

  console.log(query);
  Cube.find(query).sort({'date_updated':-1}).exec(function(err, cubes)
  {
    var pages = [];
    if(cubes.length > 12)
    {
      if(!page)
      {
        page = 0;
      }
      for(i = 0; i < cubes.length/12; i++)
      {
        if(page==i)
        {
          pages.push({
            url:raw_split[0]+':'+i,
            content:(i+1),
            active:true
          });
        }
        else
        {
          pages.push({
            url:raw_split[0]+':'+i,
            content:(i+1)
          });
        }
      }
      cube_page = [];
      for(i = 0; i < 12; i++)
      {
        if(cubes[i+page*12])
        {
          cube_page.push(cubes[i+page*12]);
        }
      }
      res.render('search',
      {
        results: cube_page,
        search:req.params.id,
        terms:terms,
        pages:pages,
        numresults:cubes.length,
        loginCallback:'/search/'+req.params.id
      });
    }
    else
    {
      res.render('search',
      {
        results: cubes,
        search:req.params.id,
        terms:terms,
        numresults:cubes.length,
        loginCallback:'/search/'+req.params.id
      });
    }
  });
});

app.get('/contact', function(req, res)
{
  res.render('contact',
  {
    loginCallback:'/contact'
  });
});
app.get('/tos', function(req, res)
{
  res.render('tos',
  {
      loginCallback:'/tos'
  });
});
app.get('/privacy', function(req, res)
{
  res.render('privacy_policy',
  {
      loginCallback:'/privacy'
  });
});
app.get('/cookies', function(req, res)
{
  res.render('cookies',
  {
      loginCallback:'/cookies'
  });
});
app.get('/ourstory', function(req, res)
{
  res.render('ourstory',
  {
      loginCallback:'/ourstory'
  });
});
app.get('/faq', function(req, res)
{
  res.render('faq',
  {
      loginCallback:'/faq'
  });
});
app.get('/404', function(req, res)
{
  res.render('404', {});
});

//Route files
let cubes =  require('./routes/cube_routes');
let users =  require('./routes/users_routes');
let devs =  require('./routes/dev_routes');
app.use('/cube', cubes);
app.use('/user', users);
app.use('/dev', devs);

app.get('*', function(req, res){
  res.redirect('/404');
});

var dict = {};
var names = [];
var nameToId = {};
var full_names = [];
var imagedict = {};

function updateCardbase()
{
  dict = {};
  names = [];
  full_names = [];
  nameToId = {};
  imagedict={};

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
}

schedule.scheduleJob('0 0 * * *', function(){
  console.log("Starting midnight cardbase update...");
  updateCardbase();
});

function saveAllCards(arr)
{
  arr.forEach(function(card, index)
  {
    card = convertCard(card);
    dict[card._id]=card;
    imagedict[card.full_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")]=
    {
      uri: card.art_crop,
      artist: card.artist
    }
    //only add if it doesn't exist, this makes the default the newest edition
    if(!nameToId[card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")])
    {
      nameToId[card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")]=[];
    }
    nameToId[card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")].push(card._id);
    binaryInsert(card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""), names);
    binaryInsert(card.full_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""), full_names);
  });
  fs.writeFile('private/names.json', JSON.stringify(names), 'utf8', function (err)
  {
      if (err)
      {
          console.log("An error occured while writing names.json");
          console.log(err);
      }
      var cardtree = turnToTree(names);

      fs.writeFile('private/cardtree.json', JSON.stringify(cardtree), 'utf8', function (err)
      {
          if (err)
          {
              console.log("An error occured while writing cardtree.json");
              console.log(err);
          }
          fs.writeFile('private/carddict.json', JSON.stringify(dict), 'utf8', function (err)
          {
              if (err)
              {
                  console.log("An error occured while writing carddict.json");
                  console.log(err);
              }
              fs.writeFile('private/nameToId.json', JSON.stringify(nameToId), 'utf8', function (err)
              {
                  if (err)
                  {
                      console.log("An error occured while writing nameToId.json");
                      console.log(err);
                  }

                  fs.writeFile('private/full_names.json', JSON.stringify(turnToTree(full_names)), 'utf8', function (err)
                  {
                      if (err)
                      {
                          console.log("An error occured while writing full_names.json");
                          console.log(err);
                      }

                      fs.writeFile('private/imagedict.json', JSON.stringify(imagedict), 'utf8', function (err)
                      {
                          if (err)
                          {
                              console.log("An error occured while writing imagedict.json");
                              console.log(err);
                          }

                          console.log("All JSON files saved.");
                      });
                  });
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
    card.name = card.name.substring(0,card.name.indexOf('/')).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  let newcard = {};
  newcard._id = card.id;
  newcard.set = card.set;
  newcard.full_name = card.name + ' [' + card.set + '-'+ card.collector_number + ']';
  newcard.name = card.name;
  newcard.name_lower = card.name.toLowerCase();
  newcard.artist = card.artist;
  newcard.scryfall_uri = card.scryfall_uri;
  newcard.rarity = card.rarity;
  if(card.tcgplayer_id)
  {
    newcard.tcgplayer_id = card.tcgplayer_id;
  }
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
  if(card.type_line.includes('//'))
  {
    newcard.type = card.type_line.substring(0,card.type_line.indexOf('/'));
  }
  else
  {
    newcard.type = card.type_line;
  }
  newcard.colors = [];
  newcard.color_identity = [];

  newcard.color_identity = newcard.color_identity.concat(card.color_identity);
  if(!card.card_faces)
  {
    newcard.colors = newcard.colors.concat(card.colors);
    newcard.parsed_cost = card.mana_cost.substr(1,card.mana_cost.length-2).toLowerCase().split('}{').reverse();
  }
  else if(card.layout =='split')
  {
    newcard.colors = newcard.colors.concat(card.colors);
    newcard.parsed_cost = card.mana_cost.substr(1,card.mana_cost.length-2).replace(' // ','{split}').toLowerCase().split('}{').reverse();
  }
  else if(card.layout =='flip')
  {
    newcard.colors = newcard.colors.concat(card.colors);
    newcard.parsed_cost = card.mana_cost.substr(1,card.mana_cost.length-2).toLowerCase().split('}{').reverse();
  }
  else if(card.card_faces[0].colors)
  {
    newcard.colors = newcard.colors.concat(card.card_faces[0].colors);
    newcard.parsed_cost = card.card_faces[0].mana_cost.substr(1,card.card_faces[0].mana_cost.length-2).toLowerCase().split('}{').reverse();
  }
  if(newcard.parsed_cost)
  {
    newcard.parsed_cost.forEach(function(item, index)
    {
      newcard.parsed_cost[index] = item.replace('/','-');
    });
  }
  if(newcard.type.toLowerCase().includes('land'))
  {
    newcard.colorcategory = 'l';
  }
  else if(newcard.color_identity.length == 0)
  {
    newcard.colorcategory = 'c';
  }
  else if(newcard.color_identity.length >  1)
  {
    newcard.colorcategory = 'm';
  }
  else if(newcard.color_identity.length ==  1)
  {
    newcard.colorcategory = newcard.color_identity[0].toLowerCase();
  }

  return newcard;
}

// Start server
http.createServer(app).listen(5000,'localhost', function()
{
  console.log('server started on port 5000...');
});
