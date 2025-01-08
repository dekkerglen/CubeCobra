const { updateCardbase } = require('./util/updatecards');
const { downloadFromS3 } = require('./jobs/download_model');

(async () => {
  await updateCardbase();
  await downloadFromS3();
  process.exit(0);
})();
