const fs = require('fs');
const path = require('path');

// This script generates a manifest.json file that maps page names to their hashed bundle filenames
// Run this after webpack build to create the manifest

const distDir = path.resolve(__dirname, 'dist/js');
const manifestPath = path.resolve(__dirname, 'dist/manifest.json');
const serverPublicManifestPath = path.resolve(__dirname, '../server/public/manifest.json');

const manifest = {};

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

  // Write to both dist and server/public directories
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(serverPublicManifestPath, JSON.stringify(manifest, null, 2));
  console.log('Generated manifest.json with', Object.keys(manifest).length, 'entries');

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
