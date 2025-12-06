import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';

import { redirect } from 'serverutils/render';
import { Request, Response } from '../types/express';

const router: Router = express.Router();

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
      if (route.method === 'get') {
        router.get(`${base}/${trimmed}${route.path}`, route.handler);
      } else if (route.method === 'post') {
        router.post(`${base}/${trimmed}${route.path}`, route.handler);
      } else if (route.method === 'delete') {
        router.delete(`${base}/${trimmed}${route.path}`, route.handler);
      }
    }
  }
};

registerRoutes('./routes', '');

export default router;
