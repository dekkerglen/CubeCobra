const { updateCardbase } = require('./src/util/updatecards');
const { downloadFromS3 } = require('./src/util/downloadModel');

(async () => {
  await updateCardbase();
  await downloadFromS3();
  process.exit(0);
})();
