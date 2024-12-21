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
const uuid = require('uuid');
const schedule = require('node-schedule');
const rateLimit = require('express-rate-limit');
const socketio = require('socket.io');
const DynamoDBStore = require('dynamodb-store');
const cloudwatch = require('./serverjs/cloudwatch');
const { updateCardbase } = require('./serverjs/updatecards');
const carddb = require('./serverjs/carddb');
const { render } = require('./serverjs/render');
const { setup } = require('./serverjs/socketio');
const flash = require('connect-flash');

// global listeners for promise rejections
process.on('unhandledRejection', (reason) => {
  cloudwatch.error('Unhandled Rejection at: Promise ', reason, reason.stack);
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
        endpoint: process.env.AWS_ENDPOINT || undefined,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-2',
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
app.use(flash());

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
const publicCORS = (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
};

// apply a rate limiter to the public api endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: '429: Too Many Requests',
});

app.use('/cube/api/cubeJSON', publicCORS);
app.use('/cube/api/cubeJSON', apiLimiter);
app.use('/cube/api/history', publicCORS);
app.use('/cube/api/history', apiLimiter);

// per-request logging configuration
app.use((req, res, next) => {
  req.uuid = uuid.v4();

  cloudwatch.info(
    JSON.stringify(
      {
        id: req.uuid,
        method: req.method,
        path: req.originalUrl,
        user_id: req.user ? req.user.id : null,
        username: req.user ? req.user.username : null,
        remoteAddr: req.ip,
        body: req.body,
      },
      null,
      2,
    ),
  );

  req.logger = {
    error: (...messages) => {
      cloudwatch.error(
        ...messages,
        JSON.stringify(
          {
            id: req.uuid,
            method: req.method,
            path: req.path,
            query: req.query,
            originalUrl: req.originalUrl,
            user: req.user
              ? {
                  id: req.user.id,
                  username: req.user.username,
                }
              : null,
          },
          null,
          2,
        ),
      );
    },
  };

  res.locals.requestId = req.uuid;
  next();
});

// check for downtime

if (process.env.DOWNTIME_ACTIVE === 'true') {
  app.use((req, res) =>
    render(req, res, 'DownTimePage', {
      title: 'Down for Maintenance',
    }),
  );
}

app.post('/healthcheck', (req, res) => {
  res.status(200).send('OK');
});

app.use((req, res, next) => {
  if (req.user && req.user.roles.includes('Banned')) {
    req.session.destroy(() => {
      req.flash('danger', 'Your account has been banned, please contact CubeCobra staff if you believe this is in error.');
      return res.redirect('/');
    });
  }

  next();
}); 


// Route files; they manage their own CSRF protection
app.use('/patreon', require('./routes/patreon_routes'));
app.use('/cache', require('./routes/cache_routes'));
app.use('/dev', require('./routes/dev_routes'));
app.use('/cube', require('./routes/cube/index'));
app.use('/public', require('./routes/cube/api_public'));
app.use('/user', require('./routes/users_routes'));
app.use('/tool', require('./routes/tools_routes'));
app.use('/comment', require('./routes/comment_routes'));
app.use('/admin', require('./routes/admin_routes'));
app.use('/content', require('./routes/content_routes'));
app.use('/multiplayer', require('./routes/multiplayer'));
app.use('/packages', require('./routes/packages'));
app.use('/api/private', require('./routes/api/private'));
app.use('/job', require('./routes/job_routes'));

app.use('', require('./routes/search_routes'));
app.use('', require('./routes/root'));

app.use((req, res) =>
  render(req, res, 'ErrorPage', {
    requestId: req.uuid,
    title: '404: Page not found',
  }),
);

app.use((err, req, res) => {
  req.logger.error(err.message, err.stack);
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
  console.info('starting midnight cardbase update...');
  await updateCardbase();
});

// Start server after carddb is initialized.
carddb.initializeCardDb().then(async () => {
  const server = http.createServer(app).listen(process.env.PORT || 5000, '127.0.0.1');
  console.info(`Server started on port ${process.env.PORT || 5000}...`);

  // init socket io
  setup(socketio(server));
});
