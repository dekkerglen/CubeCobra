import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { redirect } from 'serverutils/render';
import responseTime from 'response-time';
import { sanitizeHttpBody } from '../serverutils/logging';
import cloudwatch from '../serverutils/cloudwatch';

import { Request, Response } from '../types/express';

const router: Router = express.Router();

//After static routes so we don't bother logging response times for static assets
const responseTimer = (path: string) =>
  responseTime((req: express.Request, res: express.Response, time: number) => {
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
          matchedPath: path,
          user_id: req.user ? req.user.id : null,
          username: req.user ? req.user.username : null,
          remoteAddr: req.ip,
          body: sanitizeHttpBody(req.body),
          duration: Math.round(time * 100) / 100, //Rounds to 2 decimal places
          status: res.statusCode,
          isError: isError,
          responseSize: contentLength,
          requestSize: req.socket.bytesRead,
        },
        null,
        2,
      ),
    );
  });

// Home route - redirects to dashboard if logged in, otherwise to landing
const homeHandler = async (req: Request, res: Response) => {
  return req.user ? redirect(req, res, '/dashboard') : redirect(req, res, '/landing');
};

// Register the root route - csrfProtection is an array of middleware
router.get('/', homeHandler);

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
      const path = `${base}/${trimmed}${route.path}`;

      if (route.method === 'get') {
        router.get(path, responseTimer(path), route.handler);
      } else if (route.method === 'post') {
        router.post(path, responseTimer(path), route.handler);
      } else if (route.method === 'delete') {
        router.delete(path, responseTimer(path), route.handler);
      }
    }
  }
};

registerRoutes('./routes', '');

export default router;
