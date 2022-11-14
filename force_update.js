require('dotenv').config();
const updatedb = require('./serverjs/updatecards');

(async () => {
  await updatedb.updateCardbase();
  process.exit();
})();
