import dotenv from 'dotenv';

import 'module-alias/register';
dotenv.config();

import { UserRoles } from '@utils/datatypes/User';
import bodyParser from 'body-parser';
import compression from 'compression';
import connectFlash from 'connect-flash';
import express from 'express';
import fileUpload from 'express-fileupload';
import expressMessages from 'express-messages';
import session from 'express-session';
import http from 'http';
import schedule from 'node-schedule';
import passport from 'passport';
import path from 'path';
import responseTime from 'response-time';
import { v4 as uuid } from 'uuid';

import './types/express'; // Import the express type extensions

import configurePassport from './config/passport';
import dynamoService from './dynamo/client';
import documentClient from './dynamo/documentClient';
import router from './router/router';
import { initializeCardDb } from './serverutils/cardCatalog';
import cloudwatch from './serverutils/cloudwatch';
import DynamoDBStore from './serverutils/dynamo-session-store';
import { sanitizeHttpBody } from './serverutils/logging';
import { initializeMl } from './serverutils/ml';
import { render } from './serverutils/render';
import { updateCardbase } from './serverutils/updatecards';
import { CustomError } from './types/express';

// global listeners for promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  cloudwatch.error(
    'Unhandled Rejection at: Promise ',
    reason,
    reason instanceof Error ? reason.stack : 'Unknown stack',
  );
});

// Init app
const app = express();

// gzip middleware
app.use(compression());

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const originalSetHeader = res.setHeader;

  res.setHeader = (name: string, value: string | string[] | number) => {
    if (res.headersSent) {
      console.warn(`Headers already set at path: ${req.path} with body ${JSON.stringify(req.body)}`);
    }
    return originalSetHeader.call(res, name, value);
  };

  next();
});

// do this before https redirect
app.post('/healthcheck', (_req: express.Request, res: express.Response) => {
  res.status(200).send('OK');
});

//If this isn't a local developer environment, improve security by only allowing HTTPS
if (process.env?.NODE_ENV !== 'development') {
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    //Redirect to HTTPS for security, assuming the AWS ALB isn't forwarding the HTTPS request along nor is it the ALB health check request
    const userAgent = req.get('User-Agent') || '';
    if (req.headers['x-forwarded-proto'] !== 'https' && !userAgent.includes('ELB-HealthChecker')) {
      /* Use DOMAIN environment variable instead of relying on req.headers.host.
       * That protects us from uncontrolled redirects to another domain, which is a type of
       * HTTP Host header attack (see https://portswigger.net/web-security/host-header#how-to-prevent-http-host-header-attacks)
       */
      res.redirect('https://' + process.env.DOMAIN + req.url);
    } else {
      //If the request has good security, tell the browser to automatically use HTTPS in the future (for next 1 year)
      res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      next();
    }
  });
}

// request timeout middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.setTimeout(60 * 1000, () => {
    const err = new Error('Request Timeout') as CustomError;
    err.status = 408;
    next(err);
  });
  res.setTimeout(60 * 1000, () => {
    const err = new Error('Service Unavailable') as CustomError;
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
  }),
);

// Load view engine
app.set('views', path.join(__dirname, '../src/views'));
app.set('view engine', 'pug');

// Set Public Folder with cache control
// Hashed assets (with contenthash in filename) can be cached forever
app.use(
  '/js',
  express.static(path.join(__dirname, '../public/js'), {
    maxAge: '365d',
    immutable: true,
  }),
);

// CSS and other assets - moderate caching
app.use(
  express.static(path.join(__dirname, '../public'), {
    maxAge: '1d',
    setHeaders: (res: express.Response, filePath: string) => {
      // For hashed files (contains hash in filename), cache forever
      if (/\.[a-f0-9]{8}\.(js|css)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

// Serve static files from the React frontend app (legacy support)
app.use(express.static(path.join(__dirname, 'client')));

// Express session middleware
app.use(
  session({
    secret: process.env.SESSION || 'default-secret',
    store: new DynamoDBStore({
      table: {
        name: `${process.env.DYNAMO_PREFIX}_SESSIONS`,
        hashKey: `id`,
        hashPrefix: ``,
        readCapacityUnits: 10,
        writeCapacityUnits: 10,
      },
      dynamoService,
      documentClient,
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
app.use(connectFlash());

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.locals.messages = expressMessages(req, res);
  res.locals.node_env = app.get('env');
  next();
});

// Passport config and middleware
configurePassport(passport);

app.use(passport.initialize());
app.use(passport.session());

// per-request logging configuration
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.uuid = uuid();

  req.logger = {
    error: (...messages: any[]) => {
      res.locals.isError = true;
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

//After static routes so we don't bother logging response times for static assets
const responseTimer = responseTime((req: express.Request, res: express.Response, time: number) => {
  const responseHeaders = res.getHeaders();
  const contentLength = responseHeaders['content-length']
    ? parseInt(String(responseHeaders['content-length']), 10)
    : -1;
  const isError = res.locals.isError ?? false;

  cloudwatch.info(
    JSON.stringify(
      {
        id: req.uuid,
        method: req.method,
        path: req.originalUrl,
        user_id: req.user ? req.user.id : null,
        username: req.user ? req.user.username : null,
        remoteAddr: req.ip,
        body: sanitizeHttpBody(req.body),
        duration: Math.round(time * 100) / 100, //Rounds to 2 decimal places
        status: res.statusCode,
        isError: isError,
        responseSize: contentLength,
      },
      null,
      2,
    ),
  );
});
app.use(responseTimer);

// check for downtime

if (process.env.DOWNTIME_ACTIVE === 'true') {
  app.use((req: express.Request, res: express.Response) =>
    render(req, res, 'DownTimePage', {
      title: 'Down for Maintenance',
    }),
  );
}

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.user && req.user.roles && req.user.roles.includes(UserRoles.BANNED)) {
    req.session.destroy(() => {
      req.flash(
        'danger',
        'Your account has been banned, please contact CubeCobra staff if you believe this is in error.',
      );
      return res.redirect('/');
    });
  }

  next();
});

app.use(router);

app.use((req: express.Request, res: express.Response) =>
  render(
    req,
    res,
    'ErrorPage',
    {
      requestId: req.uuid,
      title: '404: Page not found',
    },
    {
      noindex: true,
    },
  ),
);

app.use((err: any, req: express.Request, res: express.Response) => {
  // Safely handle logging - fallback if logger middleware hasn't run yet
  if (req.logger && req.logger.error) {
    req.logger.error(err.message, err.stack);
  } else {
    console.error('Error occurred before logger middleware:', err.message, err.stack);
  }
  if (!res.statusCode) {
    res.status(500);
  }
  return render(
    req,
    res,
    'ErrorPage',
    {
      error: err.message,
      requestId: req.uuid,
      title: 'Oops! Something went wrong.',
    },
    {
      noindex: true,
    },
  );
});

// scryfall updates this data at 9, so this will minimize staleness
schedule.scheduleJob('0 10 * * *', async () => {
  console.info('starting midnight cardbase update...');
  await updateCardbase();
});

// Start server after carddb and ML models are initialized.
// Promise.all([initializeCardDb(), initializeMl()]).then(async () => {
(async () => {
  const port = process.env.PORT || 5000;
  const host = process.env.LISTEN_ON || '127.0.0.1';
  http.createServer(app).listen(Number(port), host);

  console.info(`Server started on port ${port}, listening on ${host}...`);
})();

initializeCardDb();
initializeMl();
