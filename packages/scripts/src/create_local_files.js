const fs = require('fs');

fs.mkdirSync('../server/model/', { recursive: true });
fs.writeFileSync('../server/model/elos.json', '[]');
fs.writeFileSync('../server/model/indexToOracleMap.json', '[]');
