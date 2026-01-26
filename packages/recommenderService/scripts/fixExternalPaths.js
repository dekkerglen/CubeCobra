const fs = require('fs');
const path = require('path');

// This script fixes import paths in compiled JS files to use .js extensions
// which is required for ES modules

const distPath = path.join(__dirname, '../dist');

function fixImportPaths(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      fixImportPaths(filePath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');

      // Fix relative imports that don't have .js extension
      content = content.replace(/from ['"](\.[^'"]+)['"]/g, (match, p1) => {
        if (!p1.endsWith('.js') && !p1.endsWith('.json')) {
          return `from '${p1}.js'`;
        }
        return match;
      });

      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

fixImportPaths(distPath);
console.log('Fixed external paths in dist/');
