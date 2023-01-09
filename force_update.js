const { updateCardbase } = require('./serverjs/updatecards');

(async () => {
  await updateCardbase();
  process.exit(0);
})();
