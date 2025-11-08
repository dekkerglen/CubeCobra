const fs = require('fs');
const path = require('path');

const replacements = {
  "../../../../utils": "../../utils"
};

function replaceInFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  for (let [from, to] of Object.entries(replacements)) {
    const regex = new RegExp(from, 'g');
    content = content.replace(regex, to);
  }

  fs.writeFileSync(file, content, 'utf8');
}

function processDir(dir) {
  const files = fs.readdirSync(dir);

  for (let file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      processDir(filePath);
    } else if (path.extname(filePath) === '.js') {
      replaceInFile(filePath);
    }
  }
}

processDir('dist');
