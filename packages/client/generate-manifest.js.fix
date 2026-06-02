const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// This script generates a manifest.json file that maps page names to their hashed bundle filenames
// Run this after webpack build to create the manifest

const distDir = path.resolve(__dirname, 'dist/js');
const manifestPath = path.resolve(__dirname, 'dist/manifest.json');
const serverPublicManifestPath = path.resolve(__dirname, '../server/public/manifest.json');
const serverPublicCssDir = path.resolve(__dirname, '../server/public/css');

const manifest = {};

// Hash every CSS file in server/public/css and emit a content-addressable copy
// so the upload step can mark them immutable. The source files (the un-hashed
// names) are left in place — webpack-dev-server still serves them in dev, and
// the production deploy uploads both. Old hashed copies are cleaned up first
// so the dir does not accumulate stale variants between builds.
const HASHED_CSS_RE = /\.[a-f0-9]{8}\.css$/;
const hashCssFiles = () => {
  if (!fs.existsSync(serverPublicCssDir)) return {};

  for (const file of fs.readdirSync(serverPublicCssDir)) {
    if (HASHED_CSS_RE.test(file)) {
      fs.unlinkSync(path.join(serverPublicCssDir, file));
    }
  }

  const cssMap = {};
  for (const file of fs.readdirSync(serverPublicCssDir)) {
    if (!file.endsWith('.css')) continue;
    const name = file.slice(0, -'.css'.length);
    const fullPath = path.join(serverPublicCssDir, file);
    const body = fs.readFileSync(fullPath);
    const hash = crypto.createHash('md5').update(body).digest('hex').slice(0, 8);
    const hashedName = `${name}.${hash}.css`;
    fs.writeFileSync(path.join(serverPublicCssDir, hashedName), body);
    cssMap[name] = `/css/${hashedName}`;
  }
  return cssMap;
};

if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir);

  files.forEach((file) => {
    if (file.endsWith('.bundle.js')) {
      // Extract the page name from the filename
      // Format: PageName.[hash].bundle.js or commons.[hash].bundle.js
      const match = file.match(/^(.+?)\.([a-f0-9]{8})\.bundle\.js$/);
      if (match) {
        const pageName = match[1];
        manifest[pageName] = `/js/${file}`;
      }
    }
  });

  manifest.css = hashCssFiles();

  // Write to both dist and server/public directories
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(serverPublicManifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    'Generated manifest.json with',
    Object.keys(manifest).filter((k) => k !== 'css').length,
    'JS entries and',
    Object.keys(manifest.css).length,
    'CSS entries',
  );

  // Also copy the JS files to server/public/js
  const serverPublicJsDir = path.resolve(__dirname, '../server/public/js');
  if (!fs.existsSync(serverPublicJsDir)) {
    fs.mkdirSync(serverPublicJsDir, { recursive: true });
  }

  files.forEach((file) => {
    if (file.endsWith('.bundle.js')) {
      const srcPath = path.join(distDir, file);
      const destPath = path.join(serverPublicJsDir, file);
      fs.copyFileSync(srcPath, destPath);
    }
  });

  console.log('Copied', files.filter((f) => f.endsWith('.bundle.js')).length, 'bundle files to server/public/js');
} else {
  console.error('dist/js directory not found');
  process.exit(1);
}
