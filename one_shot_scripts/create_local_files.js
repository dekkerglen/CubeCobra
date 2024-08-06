import fs from 'fs';

fs.mkdirSync('model/', { recursive: true });
fs.writeFileSync('model/elos.json', '[]');
fs.writeFileSync('model/indexToOracleMap.json', '[]');
