// Load Environment Variables
require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const http = require('http');
const fileUpload = require('express-fileupload');
const compression = require('compression');
const onFinished = require('on-finished');
const uuid = require('uuid/v4');
const schedule = require('node-schedule');
const rateLimit = require('express-rate-limit');
const socketio = require('socket.io');
const DynamoDBStore = require('dynamodb-store');
const { winston } = require('./serverjs/cloudwatch');
const { updateCardbase } = require('./serverjs/updatecards');
const carddb = require('./serverjs/carddb');
const { render } = require('./serverjs/render');
const { setup } = require('./serverjs/socketio');
const { updatePeers, alertPeers } = require('./dynamo/cache');

// global listeners for promise rejections
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise ', p, ' reason: ', reason);
});

// Init app
const app = express();

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
    console.log({
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

// body parser middleware
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

// Express session middleware
app.use(
  session({
    secret: process.env.SESSION,
    store: new DynamoDBStore({
      table: {
        name: `${process.env.DYNAMO_PREFIX}_SESSIONS`,
        hashKey: `id`,
        hashPrefix: ``,
        readCapacityUnits: 10,
        writeCapacityUnits: 10,
      },
      dynamoConfig: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
      },
      keepExpired: false,
      touchInterval: 30000,
      ttl: 1000 * 60 * 60 * 24 * 7 * 52, // 1 year
    }),
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7 * 52, // 1 year
    },
  }),
);

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

// set CORS header for cube json requests (needs to be here to be included in rate limiter response)
app.use('/cube/api/cubeJSON', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

// apply a rate limiter to the cube json endpoint
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: '429: Too Many Requests',
});
app.use('/cube/api/cubeJSON', apiLimiter);

// check for downtime

if (process.env.DOWNTIME_ACTIVE === 'true') {
  app.use((req, res) => {
    return render(req, res, 'DownTimePage', {
      title: 'Down for Maintenance',
    });
  });
}

// Route files; they manage their own CSRF protection
app.use('/patreon', require('./routes/patreon_routes'));
app.use('/dev', require('./routes/dev_routes'));
app.use('/cube', require('./routes/cube/index'));
app.use('/user', require('./routes/users_routes'));
app.use('/tool', require('./routes/tools_routes'));
app.use('/comment', require('./routes/comment_routes'));
app.use('/admin', require('./routes/admin_routes'));
app.use('/content', require('./routes/content_routes'));
app.use('/multiplayer', require('./routes/multiplayer'));
app.use('/packages', require('./routes/packages'));
app.use('/cache', require('./routes/cache_routes'));
app.use('/api/private', require('./routes/api/private'));

app.use('', require('./routes/root'));

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

// scryfall updates this data at 9, so this will minimize staleness
schedule.scheduleJob('0 10 * * *', async () => {
  console.log('starting midnight cardbase update...');
  await updateCardbase();
});

// Start server after carddb is initialized.
carddb.initializeCardDb().then(async () => {
  const server = http.createServer(app).listen(process.env.PORT || 5000, '127.0.0.1');
  console.log(`Server started on port ${process.env.PORT || 5000}...`);

  // init socket io
  setup(socketio(server));

  await updatePeers();
  await alertPeers();
});
