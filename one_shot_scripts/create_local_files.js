const fs = require('fs');

fs.mkdirSync('model/', { recursive: true });
fs.writeFileSync('model/elos.json', '[]');
fs.writeFileSync('model/indexToOracleMap.json', '[]');
