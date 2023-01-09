const { updateCardbase } = require('./serverjs/updatecards');

(async () => {
  await updateCardbase();
})();
