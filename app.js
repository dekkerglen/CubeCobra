const express = require('express');
// eslint-disable-next-line import/no-extraneous-dependencies
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const http = require('http');
const fileUpload = require('express-fileupload');
const MongoDBStore = require('connect-mongodb-session')(session);
const schedule = require('node-schedule');
const winston = require('winston');
const morgan = require('morgan');
const uuid = require('uuid/v4');
const tmp = require('tmp');
// eslint-disable-next-line import/no-unresolved
const secrets = require('../cubecobrasecrets/secrets');
// eslint-disable-next-line import/no-unresolved
const mongosecrets = require('../cubecobrasecrets/mongodb');
const updatedb = require('./serverjs/updatecards.js');
const carddb = require('./serverjs/cards.js');

const errorFile = tmp.fileSync({ prefix: `node-error-${process.pid}-`, postfix: '.log', discardDescriptor: true });
const combinedFile = tmp.fileSync({ prefix: `node-combined-${process.pid}-`, postfix: '.log', discardDescriptor: true });

const errorStackTracerFormat = winston.format((info) => {
  if (info.error && info.error.stack) {
    info.message = info.message ? `${info.message}: ${info.error.stack}` : `${info.error.stack}`;
    delete info.error;
  }
  return info;
});

winston.configure({
  level: 'info',
  format: winston.format.combine(
    winston.format.splat(), // Necessary to produce the 'meta' property
    errorStackTracerFormat(),
    winston.format.simple()
  ),
  exitOnError: false,
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log` 
    // - Write all logs error (and below) to `error.log`.
    //
    new winston.transports.File({ filename: errorFile.name, level: 'error' }),
    new winston.transports.File({ filename: combinedFile.name }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  winston.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

winston.info(`Logging to ${errorFile.name} and ${combinedFile.name}`);

carddb.initializeCardDb();

// Connect db
mongoose.connect(mongosecrets.connectionString, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.once('open', () => {
  winston.info('Connected to Mongo.');
});

// Check for db errors
db.on('error', (err) => {
  winston.error(err);
});

// Init app
const app = express();

const store = new MongoDBStore(
  {
    uri: mongosecrets.connectionString,
    databaseName: mongosecrets.dbname,
    collection: 'session_data',
  },
  (err) => {
    if (err) {
      winston.error('store failed to connect to mongoDB', err);
    }
  },
);

// error handling
app.use((req, res, next) => {
  req.uuid = uuid();
  req.logger = winston.child({
    requestId: req.uuid,
  });
  next();
});

morgan.token('uuid', (req) => req.uuid);
app.use(morgan(':remote-addr :uuid :method :url :status :res[content-length] - :response-time ms', {
  stream: {
    write: (message) => winston.info(message.trim()),
  },
}))

// upload file middleware
app.use(fileUpload());

// Body parser middleware
app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
  }),
);
app.use(
  bodyParser.json({
    limit: '50mb',
    extended: true,
  }),
);

// Load view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Set Public Folder
app.use(express.static(path.join(__dirname, 'public')));
app.use('/js', express.static(path.join(__dirname, 'dist')));
app.use('/jquery-ui', express.static(`${__dirname}/node_modules/jquery-ui-dist/`));

const sessionOptions = {
  secret: secrets.session,
  store,
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
  },
};

if (secrets.environment === 'production') {
  app.set('trust proxy', 1);
  sessionOptions.cookie.secure = true;
}

// Express session middleware
app.use(session(sessionOptions));

// Express messages middleware
app.use(require('connect-flash')());

app.use((req, res, next) => {
  res.locals.messages = require('express-messages')(req, res);
  res.locals.node_env = app.get('env');
  next();
});

// Passport config and middleware
require('./config/passport')(passport);

app.use(passport.initialize());
app.use(passport.session());

app.get('*', (req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// Route files; they manage their own CSRF protection
const cubes = require('./routes/cube_routes');
const users = require('./routes/users_routes');
const devs = require('./routes/dev_routes');
const tools = require('./routes/tools_routes');
app.use('', require('./routes/root'));

app.use('/cube', cubes);
app.use('/user', users);
app.use('/dev', devs);
app.use('/tool', tools);

app.use((req, res) => {
  res.status(404).render('misc/404', {});
});

schedule.scheduleJob('0 0 * * *', () => {
  winston.info('Starting midnight cardbase update...');
  updatedb.updateCardbase();
});

// Start server
http.createServer(app).listen(5000, 'localhost', () => {
  winston.info('server started on port 5000...');
});
