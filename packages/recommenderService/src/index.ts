import dotenv from 'dotenv';

import 'module-alias/register';
dotenv.config();

import compression from 'compression';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { v4 as uuid } from 'uuid';

import './types/express'; // Import the express type extensions

import { initializeCardCatalog } from './mlutils/cardCatalog';
import cloudwatch from './mlutils/cloudwatch';
import { downloadModelsFromS3 } from './mlutils/downloadModel';
import { initializeMl } from './mlutils/ml';
import { updateCardbase } from './mlutils/updateCards';
import router from './router/router';
import { CustomError } from './types/express';

// global listeners for promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  const message = 'Unhandled Rejection at: Promise';
  const meta = reason instanceof Error ? `${reason}\n${reason.stack}` : String(reason);
  cloudwatch.error(message, meta);
});

// Init app
const app = express();

// gzip middleware
app.use(compression());

// healthcheck endpoint
app.get('/healthcheck', (_req: express.Request, res: express.Response) => {
  res.status(200).send('OK');
});

// request timeout middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.setTimeout(30 * 1000, () => {
    const err = new Error('Request Timeout') as CustomError;
    err.status = 408;
    next(err);
  });
  res.setTimeout(30 * 1000, () => {
    const err = new Error('Service Unavailable') as CustomError;
    err.status = 503;
    next(err);
  });
  next();
});

// Add UUID to each request for tracking
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  (req as any).uuid = uuid();
  next();
});

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Attach logger to each request
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  (req as any).logger = cloudwatch;
  next();
});

// Mount router
app.use('/', router);

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    message: 'Not Found',
  });
});

// Error handler
app.use((err: CustomError, req: express.Request, res: express.Response) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  cloudwatch.error(`Error on ${req.method} ${req.path}: ${message}`, err.stack || '');

  res.status(status).json({
    success: false,
    message,
  });
});

const PORT = process.env.PORT || 5002;

async function startServer() {
  try {
    // Check if models already exist locally
    const modelDir = path.join('.', 'model');
    // These are the actual directory names in the model folder
    const requiredModels = ['encoder', 'cube_decoder', 'deck_build_decoder', 'draft_decoder'];

    const modelDirExists = fs.existsSync(modelDir);
    const modelsExist =
      modelDirExists && requiredModels.every((model) => fs.existsSync(path.join(modelDir, model, 'model.json')));

    if (!modelsExist) {
      console.log('Models not found locally. Downloading ML models from S3...');
      await downloadModelsFromS3('', process.env.DATA_BUCKET || 'cubecobra-data');
    } else {
      console.log('Using existing local ML models.');
    }

    // Check if card data files exist
    const privateDir = path.join('.', 'private');
    const requiredCardFiles = ['oracleToId.json', 'carddict.json'];
    const cardFilesExist = requiredCardFiles.every((file) => fs.existsSync(path.join(privateDir, file)));

    if (!cardFilesExist) {
      console.log('Card data files not found locally. Downloading from S3...');
      await updateCardbase('private', process.env.DATA_BUCKET || 'cubecobra-data');
    } else {
      console.log('Using existing local card data files.');
    }

    console.log('Initializing card catalog...');
    initializeCardCatalog('.');
    initializeCardCatalog('.');

    console.log('Initializing ML models...');
    await initializeMl('.');

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`Recommender Service listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
