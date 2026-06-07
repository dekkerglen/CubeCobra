import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

// Folder of source photos to annotate. Override with ANNOTATOR_IMAGES_DIR.
const IMAGES_DIR = process.env.ANNOTATOR_IMAGES_DIR
  ? path.resolve(process.env.ANNOTATOR_IMAGES_DIR)
  : path.resolve(__dirname, 'images');

// Where the per-image annotation JSON files are written.
const ANNOTATIONS_DIR = path.resolve(__dirname, 'data', 'annotations');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

const cleanName = (url: string): string => decodeURIComponent((url || '').split('?')[0].replace(/^\/+/, ''));

// Dev-server middleware that serves the local image folder and reads/writes
// annotation JSON — keeps everything to a single `vite` process, no separate API.
function annotatorApiPlugin() {
  return {
    name: 'annotator-api',
    configureServer(server: any) {
      fs.mkdirSync(ANNOTATIONS_DIR, { recursive: true });

      // List available images.
      server.middlewares.use('/api/images', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        let images: string[] = [];
        try {
          images = fs
            .readdirSync(IMAGES_DIR)
            .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
            .sort();
        } catch {
          // images dir may not exist yet
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ images, dir: IMAGES_DIR }));
      });

      // Serve an individual image.
      server.middlewares.use('/img', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        const filePath = path.join(IMAGES_DIR, cleanName(req.url));
        if (!filePath.startsWith(IMAGES_DIR) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.statusCode = 404;
          return res.end('Not found');
        }
        res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });

      // Read / write annotations for one image: /api/annotations/<imageName>.
      server.middlewares.use('/api/annotations', (req: any, res: any) => {
        const name = cleanName(req.url);
        const file = path.join(ANNOTATIONS_DIR, `${name}.json`);
        if (!file.startsWith(ANNOTATIONS_DIR)) {
          res.statusCode = 403;
          return res.end('Forbidden');
        }
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          if (fs.existsSync(file)) {
            fs.createReadStream(file).pipe(res);
          } else {
            res.end(JSON.stringify({ boxes: [] }));
          }
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              JSON.parse(body); // validate
              fs.writeFileSync(file, body);
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
  plugins: [react(), annotatorApiPlugin()],
  root: '.',
});
