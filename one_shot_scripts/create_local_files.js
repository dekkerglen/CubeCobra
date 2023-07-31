const fs = require('fs');

fs.mkdirSync('model/');
fs.writeFileSync('model/elos.json', '[]');
fs.writeFileSync('model/indexToOracleMap.json', '[]');
