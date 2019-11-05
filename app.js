const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const session = require('express-session');
const passport = require('passport');
const http = require('http');
var fileUpload = require('express-fileupload');
const secrets = require('../cubecobrasecrets/secrets');
const mongosecrets = require('../cubecobrasecrets/mongodb');
const mongoDBStore = require('connect-mongodb-session')(session);

// Connect db
mongoose.connect(mongosecrets.connectionString);
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

var store = new mongoDBStore({
  uri: mongosecrets.connectionString,
  databaseName: mongosecrets.dbname,
  collection: 'session_data'
}, function(err) {
  if (err) {
    console.log('store failed to connect to mongoDB:\n' + err);
  }
});

// Bring in models
let Cube = require('./models/cube')
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
app.use('/js', express.static(path.join(__dirname, 'dist')));
app.use('/jquery-ui', express.static(__dirname + '/node_modules/jquery-ui-dist/'));

let session_options = {
  secret: secrets.session,
  store: store,
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 //1 week
  }
}

if (secrets.environment == 'production') {
  app.set('trust proxy', 1);
  session_options.cookie.secure = true;
}

// Express session middleware
app.use(session(session_options));

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

// Route files; they manage their own CSRF protection
let cubes = require('./routes/cube_routes');
let users = require('./routes/users_routes');
let devs = require('./routes/dev_routes');
let tools = require('./routes/tools_routes');
app.use('', require('./routes/root'));
app.use('/cube', cubes);
app.use('/user', users);
app.use('/dev', devs);
app.use('/tool', tools);

app.use(function(req, res) {
  res.status(404).render('misc/404', {});
});

// Start server
http.createServer(app).listen(5000, 'localhost', function() {
  console.log('server started on port 5000...');
});