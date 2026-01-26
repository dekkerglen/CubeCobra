import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import responseTime from 'response-time';

import cloudwatch from '../mlutils/cloudwatch';

const router: Router = express.Router();

// Response time tracking middleware
const responseTimer = responseTime((req: express.Request, res: express.Response, time: number) => {
  const responseHeaders = res.getHeaders();
  const contentLength = responseHeaders['content-length']
    ? parseInt(String(responseHeaders['content-length']), 10)
    : -1;

  cloudwatch.info(
    JSON.stringify(
      {
        id: (req as any).uuid,
        method: req.method,
        path: req.originalUrl,
        matchedPath: req.route?.path ?? req.originalUrl,
        remoteAddr: req.ip,
        duration: Math.round(time * 100) / 100,
        status: res.statusCode,
        responseSize: contentLength,
        requestSize: req.socket.bytesRead,
      },
      null,
      2,
    ),
  );
});


router.get('/', (_, res) => {
  return res.json({
    service: 'CubeCobra ML Recommender Service',
    version: '1.0.0',
    status: 'running',
  });
});

export const registerRoutes = (directory: string, base: string) => {
  const fullPath = path.join(__dirname, directory);
  const files = fs.readdirSync(fullPath).filter((file) => fs.statSync(path.join(fullPath, file)).isFile());
  const folders = fs.readdirSync(fullPath).filter((file) => fs.statSync(path.join(fullPath, file)).isDirectory());

  for (const folder of folders) {
    registerRoutes(path.join(directory, folder), `${base}/${folder}`);
  }

  for (const file of files) {
    const trimmed = file.split('.')[0];

    // Skip index.ts as it's handled directly in router.ts
    if (trimmed === 'index') {
      continue;
    }

    const { routes } = require(path.join(__dirname, `./routes${base}/${trimmed}`));

    for (const route of routes) {
      const routePath = `${base}/${trimmed}${route.path}`;

      if (route.method === 'get') {
        router.get(routePath, responseTimer, route.handler);
      } else if (route.method === 'post') {
        router.post(routePath, responseTimer, route.handler);
      } else if (route.method === 'delete') {
        router.delete(routePath, responseTimer, route.handler);
      }
    }
  }
};

registerRoutes('./routes', '');

export default router;
