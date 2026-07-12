import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

// Every file in src/pages is a page entry: the server renders main.pug for a given page name
// and loads that entry, which self-mounts via RenderToRoot. Build them all as Vite inputs so
// each gets its own hashed chunk (React and shared code split into shared chunks automatically),
// and the emitted manifest maps page name -> file (+ imported chunks + css) for the server.
const pagesDir = path.resolve(__dirname, 'src/pages');
const allPages = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.tsx'));
// VITE_SUBSET (comma-separated page names) limits the build during migration iteration.
const subset = process.env.VITE_SUBSET?.split(',').map((s) => s.trim());
const pages = subset ? allPages.filter((f) => subset.includes(path.basename(f, '.tsx'))) : allPages;

const input = Object.fromEntries(pages.map((f) => [path.basename(f, '.tsx'), path.resolve(pagesDir, f)]));

export default defineConfig({
  // Assets are served under /app/ (Express serves packages/server/public, and cdnUrl prepends
  // CDN_BASE_URL in prod). Keep in sync with the static-serve path + upload flow.
  base: '/app/',
  // Dev: Vite serves the page entries + HMR here; the node server (a different origin) renders the
  // HTML and points <script type=module> at this server (see main.pug's viteDev branch). `origin`
  // makes Vite emit absolute asset URLs, `cors` lets the node-origin page fetch modules, and
  // `fs.allow` opens the monorepo root so cross-package @utils imports (../utils) can be served.
  server: {
    host: process.env?.LISTEN_ON ? process.env?.LISTEN_ON : '127.0.0.1',
    port: 5173,
    strictPort: true,
    origin: 'http://localhost:5173',
    cors: true,
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
  plugins: [react()],
  resolve: {
    // Native tsconfig `paths` resolution (Vite 8+) — much faster than the vite-tsconfig-paths
    // plugin, which dominated build time. Handles the client-scoped aliases (components/, etc.).
    tsconfigPaths: true,
    // `@utils` is the one cross-package alias: it's used both by client files AND by files inside
    // packages/utils itself (e.g. FilterCards.ts imports @utils/generated/...). tsconfig paths only
    // apply within the client tsconfig's file set, so a utils-internal @utils import wouldn't
    // resolve — mirror webpack's global resolve.alias here so it works everywhere.
    alias: { '@utils': path.resolve(__dirname, '../utils/src') },
  },
  build: {
    // Emit straight into the server's public dir so the existing static-serve + S3 upload
    // (which walks packages/server/public) pick it up unchanged.
    outDir: path.resolve(__dirname, '../server/public/app'),
    emptyOutDir: true,
    manifest: true,
    target: 'es2020',
    rollupOptions: { input },
  },
});
