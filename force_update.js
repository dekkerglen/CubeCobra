const winston = require('winston');
const updatedb = require('./serverjs/updatecards.js');

winston.configure({
  level: 'info',
  format: winston.format.simple(),
  exitOnError: false,
  transports: [new winston.transports.Console()],
});
updatedb.updateCardbase();
