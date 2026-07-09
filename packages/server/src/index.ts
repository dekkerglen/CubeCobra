import dotenv from 'dotenv';

import 'module-alias/register';
dotenv.config();

import { cdnUrl } from '@utils/cdnUrl';
import { UserRoles } from '@utils/datatypes/User';
import { MAX_UPLOAD_BYTES } from '@utils/hostedImagesUtil';
import bodyParser from 'body-parser';
import compression from 'compression';
import connectFlash from 'connect-flash';
import express from 'express';
import fileUpload from 'express-fileupload';
import expressMessages from 'express-messages';
import session from 'express-session';
import fs from 'fs';
import http from 'http';
import schedule from 'node-schedule';
import passport from 'passport';
import path from 'path';
import { v4 as uuid } from 'uuid';

import './types/express'; // Import the express type extensions

import configurePassport from './config/passport';
import dynamoService from './dynamo/client';
import documentClient from './dynamo/documentClient';
import { isPatreonHookPath } from './router/routes/patreon';
import { initializeCardDb, isCardDbReady, whenCardDbReady } from './serverutils/cardCatalog';
import DynamoDBStore from './serverutils/dynamo-session-store';
import { logError, logInfo } from './serverutils/errorLog';
import { render } from './serverutils/render';
import { checkAndUpdateCardbase } from './serverutils/updatecards';
import { CustomError } from './types/express';

// global listeners for promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  // No request context is available here (the rejection escaped its handler), but the
  // structured record still captures the error type + originating app frame.
  logError([reason], undefined, { unhandledRejection: true });
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
if (process.env?.NODE_ENV !== 'development' && process.env?.HTTP_ONLY !== 'true') {
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

// upload file middleware. Cap uploads to the hosted-image input limit and abort oversized
// requests rather than buffering them.
app.use(fileUpload({ limits: { fileSize: MAX_UPLOAD_BYTES }, abortOnLimit: true }));

// body parser middleware
app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
  }),
);
app.use(
  bodyParser.json({
    limit: '50mb',
    // Capture the raw request bytes for routes that verify an HMAC signature over the
    // exact payload the sender signed (the Patreon webhook). Re-serializing the parsed
    // body is not byte-exact, so the signature must be checked against these raw bytes.
    // Scoped to the webhook path so we don't retain large buffers for every request.
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      if (isPatreonHookPath(req.originalUrl)) {
        (req as any).rawBody = buf;
      }
    },
  }),
);

// Load view engine
app.set('views', path.join(__dirname, '../src/views'));
app.set('view engine', 'pug');
// Expose cdnUrl to all Pug templates so view code can wrap static asset paths.
// When CDN_BASE_URL is set, hrefs resolve to CloudFront; otherwise same-origin.
app.locals.cdnUrl = cdnUrl;
// GA4 Measurement ID (G-XXXXXXXXXX). Only loaded in production; unset disables
// analytics entirely (dev/staging never report).
app.locals.gaMeasurementId = process.env.GA_MEASUREMENT_ID;

// Main-site robots.txt. Served explicitly (and registered before the static
// public/ handler below so it wins) because public/robots.txt is the deny-all
// ASSET-host policy that gets uploaded to the assets S3 bucket -- the content
// site needs its own indexable policy. Read once at startup; see the file for
// rationale on the disallow list. Lives under src/static/ because the build
// only copies src/static/** (and *.pug) into dist alongside the compiled app.
const mainRobotsTxt = fs.readFileSync(path.join(__dirname, '../src/static/robots.txt'), 'utf8');
app.get('/robots.txt', (_req: express.Request, res: express.Response) => {
  res.type('text/plain');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(mainRobotsTxt);
});

// Static asset serving from the Express server.
// In production this is a fallback only — assets are served from CloudFront
// (s3 sync runs in the publish flow, EB env sets CDN_BASE_URL). The handlers
// stay registered so that any reference still resolved same-origin (legacy
// hot-links, internal tooling) keeps working until we remove them in a later
// phase. In dev (CDN_BASE_URL unset) these are the actual serve path.
app.use(
  '/js',
  express.static(path.join(__dirname, '../public/js'), {
    maxAge: process.env.NODE_ENV === 'development' ? 0 : '365d',
    immutable: process.env.NODE_ENV !== 'development',
  }),
);

// CSS and other assets - moderate caching
app.use(
  express.static(path.join(__dirname, '../public'), {
    maxAge: process.env.NODE_ENV === 'development' ? 0 : '1d',
    setHeaders: (res: express.Response, filePath: string) => {
      // For hashed files (contains hash in filename), cache forever
      if (/\.[a-f0-9]{8}\.(js|css)$/.test(filePath)) {
        res.setHeader(
          'Cache-Control',
          process.env.NODE_ENV === 'development' ? 'no-cache' : 'public, max-age=31536000, immutable',
        );
      }
    },
  }),
);

// The catalog files (imagedict/full_names/cardimages) are no longer
// served to the browser at all — card-name autocomplete and image lookups go
// through /tool/api/cardnames and /tool/api/cardimagedata, which read the
// in-memory catalog. Nothing ships these multi-MB files over the wire.

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
      touchInterval: 300000, // 5 minutes - reduced from 30 seconds to reduce memory pressure
      ttl: 1000 * 60 * 60 * 24 * 30, // 30 days - reduced from 1 year to reduce memory footprint
    }),
    resave: false, // Changed from true - only save session if modified
    saveUninitialized: false, // Changed from true - don't save empty sessions
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days - reduced from 1 year
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

  const loggerContext = () => ({
    requestId: req.uuid,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    query: req.query,
    authenticated: !!req.user,
    userId: req.user?.id ?? null,
    username: req.user?.username ?? null,
  });

  req.logger = {
    error: (...messages: any[]) => {
      res.locals.isError = true;
      logError(messages, loggerContext());
    },
    // Expected, non-actionable conditions. Emits to the info stream and does NOT flag the
    // request as an error, so it stays out of the admin Errors dashboard.
    info: (...messages: any[]) => {
      logInfo(messages, loggerContext());
    },
  };

  res.locals.requestId = req.uuid;
  next();
});

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

// Startup runs two slow tasks concurrently (see the bottom of this file): loading the card
// catalog and registering the route tree. In dev the server starts listening before either
// finishes, so this gate holds app routes until BOTH are ready — early requests wait rather
// than 404 (routes not mounted yet) or hit an empty catalog. Static assets and /healthcheck
// are mounted earlier and stay instant. In production we only listen once both are done, so
// the gate is a no-op and isn't installed.
let routesReady = false;
let resolveRoutesReady: () => void;
const routesReadyPromise = new Promise<void>((resolve) => {
  resolveRoutesReady = resolve;
});
const whenAppReady = (): Promise<unknown> => Promise.all([whenCardDbReady(), routesReadyPromise]);

if (process.env.NODE_ENV !== 'production') {
  app.use((_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (isCardDbReady() && routesReady) {
      next();
    } else {
      whenAppReady().then(() => next());
    }
  });
}

// Mounts the application router plus the 404 and error-handling middleware. Exported and async
// so startup can run it concurrently with initializeCardDb(): the route module graph is pulled
// in here via a dynamic import() rather than a top-of-file static import. A static import would
// force every route/controller/model module to load and transpile (slow under tsx) before the
// rest of index.ts — serializing route loading ahead of the catalog load. Registering the
// router here (after the dev gate above) keeps it, the 404, and the error handler last.
export async function registerRoutes(expressApp: express.Express): Promise<void> {
  const routeStart = Date.now();
  if (process.env.NODE_ENV !== 'production') {
    console.info('Loading routes...');
  }

  // `.js` extension (not `.ts`): a dynamic import() is ESM even in this CJS-typed package, and
  // nodenext requires the output extension here. TS and tsx both resolve it to router.ts. The
  // named `router` binding (not `.default`) sidesteps the dynamic-import default-interop quirk.
  const { router } = await import('./router/router.js');
  expressApp.use(router);

  expressApp.use((req: express.Request, res: express.Response) =>
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

  // Error-handling middleware. MUST have four parameters (err, req, res, next) — Express
  // only treats a middleware as an error handler when its arity is 4, so this is what makes
  // next(err) (from async handlers, the request timeout, etc.) actually render our error
  // page and log with request context, instead of falling through to Express's default.
  expressApp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // If the response has already started, we can't render an error page over it. This is
    // typically a follow-on error (e.g. the request timed out and responded, then a slow
    // handler resolved and tried to send again) — the original cause was already logged, so
    // don't log this artifact. Delegate to Express's default handler to close the connection.
    if (res.headersSent) {
      return next(err);
    }

    // Safely handle logging - fallback if logger middleware hasn't run yet
    if (req.logger && req.logger.error) {
      req.logger.error(err);
    } else {
      console.error('Error occurred before logger middleware:', err?.message, err?.stack);
    }

    res.status(typeof err?.status === 'number' ? err.status : 500);
    return render(
      req,
      res,
      'ErrorPage',
      {
        error: err?.message,
        requestId: req.uuid,
        title: 'Oops! Something went wrong.',
      },
      {
        noindex: true,
      },
    );
  });

  routesReady = true;
  resolveRoutesReady();
  if (process.env.NODE_ENV !== 'production') {
    console.info(`Routes loaded in ${((Date.now() - routeStart) / 1000).toFixed(2)}s`);
  }
}

// Check for card database updates every 30 minutes
// Update if data is over a week old or if card count has changed
schedule.scheduleJob('*/30 * * * *', async () => {
  console.info('Checking for card database updates...');
  const bucket = process.env.DATA_BUCKET || 'cubecobra-public';
  await checkAndUpdateCardbase('private', bucket);
});

const startListening = () => {
  const port = process.env.PORT || 5000;
  const host = process.env.LISTEN_ON || '127.0.0.1';
  http.createServer(app).listen(Number(port), host);

  console.info(`Server started on port ${port}, listening on ${host}...`);
  console.info(`ML service URL: ${process.env.ML_SERVICE_URL || 'http://localhost:5002'}`);
};

if (process.env.NODE_ENV === 'production') {
  // Production: register routes and load the card catalog concurrently, then accept traffic.
  Promise.all([registerRoutes(app), initializeCardDb()]).then(startListening);
} else {
  // Dev: start listening immediately so nodemon restarts are near-instant, then register routes
  // and load the card catalog concurrently in the background (previously the route module graph
  // loaded synchronously *before* the catalog even started). The gate middleware above holds app
  // requests until both finish; static assets and /healthcheck respond right away.
  startListening();
  Promise.all([
    registerRoutes(app).then(() => console.info('Routes ready.')),
    initializeCardDb().then(() => console.info('Card catalog ready.')),
  ]).catch((e) => console.error('Startup task failed; some routes may hang:', e));
}
