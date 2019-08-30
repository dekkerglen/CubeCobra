const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
const config = require('./config/database');
var schedule = require('node-schedule');
const http = require('http');
var fileUpload = require('express-fileupload');
var util = require('./serverjs/util.js');
var updatedb = require('./serverjs/updatecards.js');
const secrets = require('../cubecobrasecrets/secrets');

// Connect db
mongoose.connect(config.database);
let db = mongoose.connection;
db.once('open', function() {
  console.log('connected to nodecube db');
});

// Check for db errors
db.on('error', function(err) {
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
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true
}));
app.use(bodyParser.json({
  limit: '50mb',
  extended: true
}));

//Load view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Set Public Folder
app.use(express.static(path.join(__dirname, 'public')));

// Express session middleware
app.use(session({
  secret: secrets.session,
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: true,
    maxAge: 365 * 24 * 60 * 60 * 1000
  }
}));

//Express messages middleware
app.use(require('connect-flash')());
app.use(function(req, res, next) {
  res.locals.messages = require('express-messages')(req, res);
  next();
});

// Express validator middleware
app.use(expressValidator({
  errorFormatter: function(param, msg, value) {
    var namespace = param.split('.'),
      root = namespace.shift(),
      formParam = root;

    while (namespace.length) {
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

app.get('*', function(req, res, next) {
  res.locals.user = req.user || null;
  next();
});

// Home route
app.get('/', function(req, res) {
  const routeReady = () => {
    if (recents && drafted && blog && decks) {
      decklinks = decks.splice(Math.max(decks.length - 10, 0), decks.length);
      res.render('index', {
        devblog: blog.length > 0 ? blog[0] : null,
        recents: recents,
        drafted: drafted,
        decks: decklinks
      });
    }
  };

  var user_id = '';
  var recents, drafted, blog, decks;

  if (req.user) user_id = req.user._id;
  Cube.find({
    'card_count': {
      $gt: 200
    },
    $or: [{
      'isListed': true
    }, {
      'isListed': null
    }, {
      'owner': user_id
    }]
  }).sort({
    'date_updated': -1
  }).limit(12).exec(function(err, result) {
    if (err) {
      recents = [];
      console.log('recents failed to load');
    }

    if (result) {
      recents = result;
    }

    routeReady();
  });

  Cube.find({
    $or: [{
      'isListed': true
    }, {
      'isListed': null
    }, {
      'owner': user_id
    }]
  }).sort({
    'numDecks': -1
  }).limit(12).exec(function(err, result) {
    if (err) {
      drafted = [];
      console.log('drafted failed to load');
    }

    if (result) {
      drafted = result;
    }

    routeReady();
  });

  Blog.find({
    dev: 'true'
  }).sort({
    'date': -1
  }).exec(function(err, result) {
    if (err) {
      blog = [];
      console.log('blog failed to load');
    }

    if (result) {
      blog = result;
    }

    routeReady();
  });

  Deck.find().sort({
    'date': -1
  }).limit(10).exec(function(err, result) {
    if (err) {
      decks = [];
      console.log('decks failed to load');
    }

    if (result) {
      decks = result;
    }

    routeReady();
  });
});


//format: {search};{search};{search}:{page}
//list like:
//{property}{symbol}{value};
//properties:
//name, owner
//symbols:
//=,~(contains)
app.get('/advanced_search', function(req, res) {
  res.render('search/advanced_search', {
    loginCallback: '/advanced_search'
  });
});

app.post('/advanced_search', function(req, res) {
  var url = '/search/';
  if (req.body.name && req.body.name.length > 0) {
    url += 'name' + req.body.nameType + req.body.name + ';';
  }
  if (req.body.owner && req.body.owner.length > 0) {
    url += 'owner_name' + req.body.ownerType + req.body.owner + ';';
  }
  res.redirect(url)
});

app.post('/search', function(req, res) {
  if (!req.body.search || req.body.search.length == 0) {
    req.flash('danger', 'No Search Parameters');
    res.redirect('/advanced_search');
  } else {
    var query = req.body.search;
    if (query.includes(';')) {
      res.redirect('/search/' + query)
    } else {
      res.redirect('/search/name~' + query);
    }
  }
});

app.get('/search/:id', function(req, res) {
  var raw_split = req.params.id.split(':');
  var raw_queries = raw_split[0].split(';');
  var page = parseInt(raw_split[1]);
  var query = {};
  var terms = [];
  raw_queries.forEach(function(val, index) {
    if (val.includes('=')) {
      var split = val.split('=');
      query[split[0]] = split[1];
      terms.push(split[0].replace('owner_name', 'owner') + ' is exactly ' + split[1]);
    } else if (val.includes('~')) {
      var split = val.split('~');
      query[split[0]] = {
        "$regex": split[1],
        "$options": "i"
      };
      terms.push(split[0].replace('owner_name', 'owner') + ' contains ' + split[1]);
    }
  });

  var user_id = '';
  if (req.user) user_id = req.user._id;
  query = {
    $and: [query,
      {
        $or: [{
            'isListed': true
          },
          {
            'owner': user_id
          }
        ]
      }
    ]
  };

  Cube.find(query).sort({
    'date_updated': -1
  }).exec(function(err, cubes) {
    var pages = [];
    if (cubes.length > 12) {
      if (!page) {
        page = 0;
      }
      for (i = 0; i < cubes.length / 12; i++) {
        if (page == i) {
          pages.push({
            url: raw_split[0] + ':' + i,
            content: (i + 1),
            active: true
          });
        } else {
          pages.push({
            url: raw_split[0] + ':' + i,
            content: (i + 1)
          });
        }
      }
      cube_page = [];
      for (i = 0; i < 12; i++) {
        if (cubes[i + page * 12]) {
          cube_page.push(cubes[i + page * 12]);
        }
      }
      res.render('search', {
        results: cube_page,
        search: req.params.id,
        terms: terms,
        pages: pages,
        numresults: cubes.length,
        loginCallback: '/search/' + req.params.id
      });
    } else {
      res.render('search', {
        results: cubes,
        search: req.params.id,
        terms: terms,
        numresults: cubes.length,
        loginCallback: '/search/' + req.params.id
      });
    }
  });
});

app.get('/contact', function(req, res) {
  res.render('info/contact', {
    loginCallback: '/contact'
  });
});

app.get('/tos', function(req, res) {
  res.render('info/tos', {
    loginCallback: '/tos'
  });
});

app.get('/privacy', function(req, res) {
  res.render('info/privacy_policy', {
    loginCallback: '/privacy'
  });
});

app.get('/cookies', function(req, res) {
  res.render('info/cookies', {
    loginCallback: '/cookies'
  });
});

app.get('/ourstory', function(req, res) {
  res.render('info/ourstory', {
    loginCallback: '/ourstory'
  });
});

app.get('/faq', function(req, res) {
  res.render('info/faq', {
    loginCallback: '/faq'
  });
});

app.get('/donate', function(req, res) {
  res.render('info/donate', {
    loginCallback: '/donate'
  });
});

app.get('/404', function(req, res) {
  res.render('misc/404', {});
});

//Route files
let cubes = require('./routes/cube_routes');
let users = require('./routes/users_routes');
let devs = require('./routes/dev_routes');
app.use('/cube', cubes);
app.use('/user', users);
app.use('/dev', devs);

app.get('*', function(req, res) {
  res.redirect('/404');
});

/*
schedule.scheduleJob('0 0 * * *', function(){
  console.log("Starting midnight cardbase update...");
  updatedb.updateCardbase();
});
*/

// Start server
http.createServer(app).listen(5000, 'localhost', function() {
  console.log('server started on port 5000...');
});
