// Load Environment Variables
require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const http = require('http');
const fileUpload = require('express-fileupload');
const compression = require('compression');
const MongoDBStore = require('connect-mongodb-session')(session);
const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
const AWS = require('aws-sdk');
const onFinished = require('on-finished');
const uuid = require('uuid/v4');
const schedule = require('node-schedule');
const rateLimit = require('express-rate-limit');
const updatedb = require('./serverjs/updatecards.js');
const carddb = require('./serverjs/cards.js');
const CardRating = require('./models/cardrating');
const { render } = require('./serverjs/render');

const formatInfo = ({ message }) => {
  try {
    return JSON.stringify(message);
  } catch (err) {
    return 'Error formatting info';
  }
};
const formatError = ({ message, stack, request }) =>
  JSON.stringify({
    level: 'error',
    message,
    target: request ? request.originalUrl : null,
    uuid: request ? request.uuid : null,
    stack: (stack || '').split('\n'),
  });

const linearFormat = winston.format((info) => {
  if (info.message.type === 'request') {
    info.message = `request: ${info.message.path}`;
  } else if (info.level === 'error') {
    info.message = `${info.message} ${info.stack}`;
    delete info.stack;
    delete info.request;
  }
  delete info.type;
  return info;
});

const consoleFormat = winston.format.combine(linearFormat(), winston.format.simple());

if (process.env.ENV === 'production') {
  winston.configure({
    level: 'info',
    format: winston.format.json(),
    exitOnError: false,
    transports: [
      new WinstonCloudWatch({
        level: 'info',
        cloudWatchLogs: new AWS.CloudWatchLogs(),
        logGroupName: `${process.env.AWS_LOG_GROUP}_${process.env.AWS_LOG_STREAM}_info`,
        logStreamName: uuid(),
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
        awsRegion: process.env.AWS_REGION,
        retentionInDays: parseInt(process.env.LOG_RETENTION_DAYS, 10),
        messageFormatter: formatInfo,
      }),
      new WinstonCloudWatch({
        level: 'error',
        cloudWatchLogs: new AWS.CloudWatchLogs(),
        logGroupName: `${process.env.AWS_LOG_GROUP}_${process.env.AWS_LOG_STREAM}_error`,
        logStreamName: uuid(),
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
        awsRegion: process.env.AWS_REGION,
        retentionInDays: parseInt(process.env.LOG_RETENTION_DAYS, 10),
        messageFormatter: formatError,
      }),
    ],
  });
} else {
  winston.configure({
    level: 'info',
    format: winston.format.json(),
    exitOnError: false,
    transports: [new winston.transports.Console({ format: consoleFormat })],
  });
}

// Connect db
mongoose.connect(process.env.MONGODB_URL, {
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
    uri: process.env.MONGODB_URL,
    collection: 'session_data',
  },
  (err) => {
    if (err) {
      winston.error('Store failed to connect to mongoDB.', { error: err });
    }
  },
);

// gzip middleware
app.use(compression());

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

  req.logger = {
    error: (err) => {
      // err.requst = req;
      winston.error({
        message: err.message,
        stack: err.stack,
        request: req,
      });
    },
    info: (message) => winston.info(message),
  };

  res.locals.requestId = req.uuid;
  res.startTime = Date.now();
  onFinished(res, (err, finalRes) => {
    winston.info({
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
    limit: '200mb',
    extended: true,
  }),
);
app.use(
  bodyParser.json({
    limit: '200mb',
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
  secret: process.env.SESSION,
  store,
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 * 52, // 1 year
  },
};

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

// apply a rate limiter to the cube json endpoint
const apiLimiter = rateLimit({
  windowMs: 60000,
  max: 1,
  message: '429: Too Many Requests',
});
app.use('/cube/api/cubeJSON', apiLimiter);

// Route files; they manage their own CSRF protection
app.use('', require('./routes/root'));

app.use('/cube', require('./routes/cube_routes'));
app.use('/user', require('./routes/users_routes'));
app.use('/dev', require('./routes/dev_routes'));
app.use('/tool', require('./routes/tools_routes'));
app.use('/comment', require('./routes/comment_routes'));
app.use('/admin', require('./routes/admin_routes'));
app.use('/content', require('./routes/content_routes'));

app.use((req, res) => {
  return render(req, res, 'ErrorPage', {
    requestId: req.uuid,
    title: '404: Page not found',
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  req.logger.error(err);
  if (!res.statusCode) {
    res.status(500);
  }
  return render(req, res, 'ErrorPage', {
    error: err.message,
    requestId: req.uuid,
    title: 'Oops! Something went wrong.',
  });
});

// scryfall updates this data at 9, so his will minimize staleness
schedule.scheduleJob('0 10 * * *', async () => {
  winston.info('String midnight cardbase update...');
  const ratings = await CardRating.find({}, 'name elo').lean();

  updatedb.updateCardbase(ratings);
});

// Start server after carddb is initialized.
carddb.initializeCardDb().then(() => {
  http.createServer(app).listen(process.env.PORT || 5000, '127.0.0.1', () => {
    winston.info(`Server started on port ${process.env.PORT || 5000}...`);
  });
});
