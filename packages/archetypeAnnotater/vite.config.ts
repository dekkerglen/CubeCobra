import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

// Simple Vite plugin to serve data files and handle annotation CRUD
function dataApiPlugin() {
  const dataDir = path.resolve(__dirname, 'data');
  const annotationsPath = path.resolve(dataDir, 'app', 'annotations.json');

  return {
    name: 'data-api',
    configureServer(server: any) {
      // Serve static data files at /data/*
      server.middlewares.use('/data', (req: any, res: any, next: any) => {
        const safePath = path.normalize(req.url).replace(/^(\.\.(\/|\\|$))+/, '');
        const filePath = path.join(dataDir, safePath);
        if (!filePath.startsWith(dataDir)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath);
          const types: Record<string, string> = {
            '.json': 'application/json',
            '.bin': 'application/octet-stream',
            '.txt': 'text/plain',
          };
          res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });

      // Annotations API
      server.middlewares.use('/api/annotations', (req: any, res: any) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          if (fs.existsSync(annotationsPath)) {
            fs.createReadStream(annotationsPath).pipe(res);
          } else {
            res.end('{}');
          }
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: string) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const annotations = JSON.parse(body);
              fs.writeFileSync(annotationsPath, JSON.stringify(annotations, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end('Method not allowed');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), dataApiPlugin()],
  root: '.',
  publicDir: 'public',
});
