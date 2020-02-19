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
const { Loggly } = require('winston-loggly-bulk');
const onFinished = require('on-finished');
const uuid = require('uuid/v4');
const tmp = require('tmp');
// eslint-disable-next-line import/no-unresolved
const secrets = require('../cubecobrasecrets/secrets');
// eslint-disable-next-line import/no-unresolved
const mongosecrets = require('../cubecobrasecrets/mongodb');
const updatedb = require('./serverjs/updatecards.js');
const carddb = require('./serverjs/cards.js');

const errorFile = tmp.fileSync({ prefix: `node-error-${process.pid}-`, postfix: '.log', discardDescriptor: true });
const combinedFile = tmp.fileSync({
  prefix: `node-combined-${process.pid}-`,
  postfix: '.log',
  discardDescriptor: true,
});

const timestampedFormat = winston.format((info) => {
  if (info.message) {
    info.message = `[${new Date(Date.now()).toISOString()}] ${info.message}`;
  }
  return info;
});

const linearFormat = winston.format((info) => {
  if (info.type === 'request') {
    // :remote-addr :uuid :method :url :status :res[content-length] - :response-time ms
    const length = info.length === undefined ? '-' : info.length;
    info.message = `${info.remoteAddr} ${info.requestId} ${info.method} ${info.path} ${info.status} ${length} ${info.elapsed}ms`;
    delete info.remoteAddr;
    delete info.requestId;
    delete info.method;
    delete info.path;
    delete info.status;
    delete info.length;
    delete info.elapsed;
  } else if (info.error) {
    info.message = info.message
      ? `${info.message}: ${info.error.message}: ${info.error.stack}`
      : `${info.error.message}: ${info.error.stack}`;
    delete info.error;
  }
  delete info.type;
  return info;
});

const textFormat = winston.format.combine(linearFormat(), winston.format.simple());
const consoleFormat = winston.format.combine(linearFormat(), timestampedFormat(), winston.format.simple());

winston.configure({
  level: 'info',
  format: winston.format.json(),
  exitOnError: false,
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    new winston.transports.File({ filename: errorFile.name, level: 'error', format: textFormat }),
    new winston.transports.File({ filename: combinedFile.name, format: textFormat }),
    new winston.transports.Console({ format: consoleFormat }),
  ],
});

console.log(`Logging to ${errorFile.name} and ${combinedFile.name}`);

if (secrets.loggly) {
  winston.add(
    new Loggly({
      token: secrets.loggly.token,
      subdomain: secrets.loggly.subdomain,
      tags: ['Winston-NodeJS'],
      json: true,
    }),
  );
  console.log(`Logging to Loggly @ https://${secrets.loggly.subdomain}.loggly.com.`);
}

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
      winston.error('Store failed to connect to mongoDB.', { error: err });
    }
  },
);

// request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(60 * 1000, () => {
    const err = new Error('Request Timeout');
    err.status = 408;
    next(err);
  });
  res.setTimeout(60 * 1000, () => {
    const err = new Error('Service Unavailable');
    err.status = 503;
    next(err);
  });
  next();
});

// per-request logging configuration
app.use((req, res, next) => {
  req.uuid = uuid();
  req.logger = winston.child({
    requestId: req.uuid,
  });
  res.locals.requestId = req.uuid;
  res.startTime = Date.now();
  onFinished(res, (err, finalRes) => {
    req.logger.log({
      level: 'info',
      type: 'request',
      remoteAddr: req.ip,
      requestId: req.uuid,
      method: req.method,
      path: req.path,
      status: finalRes.statusCode,
      length: finalRes.getHeader('content-length'),
      elapsed: Date.now() - finalRes.startTime,
    });
  });
  next();
});

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

app.use((req, res, next) => {
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

app.get('/500', (req, res, next) => {
  next(new Error('Test error'));
});

app.use((req, res) => {
  res.status(404).render('misc/404', {});
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  req.logger.error(null, { error: err });
  if (!res.statusCode) {
    res.status(500);
  }
  res.render('misc/500', {
    error: err.message,
  });
});

schedule.scheduleJob('0 0 * * *', () => {
  winston.info('Starting midnight cardbase update...');
  updatedb.updateCardbase();
});

// Start server after carddb is initialized.
carddb.initializeCardDb().then(() => {
  http.createServer(app).listen(5000, 'localhost', () => {
    winston.info('Server started on port 5000...');
  });
});
