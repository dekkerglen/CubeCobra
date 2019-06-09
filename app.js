
const express = require('express');
const path = require('path');
const mongoose =  require('mongoose');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
const config = require('./config/database');
const http = require('http');
const fs = require('fs');

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
let api =  require('./routes/api');
app.use('/cube', cubes);
app.use('/user', users);
app.use('/api', api);


// Start server
http.createServer(app).listen(5000,'localhost', function()
{
  console.log('server started on port 5000...');
});
