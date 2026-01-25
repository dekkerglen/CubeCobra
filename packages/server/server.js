require('module-alias/register');
const { updateCardbase } = require('./dist/server/src/serverutils/updatecards');
const { downloadModelsFromS3 } = require('./dist/server/src/serverutils/downloadModel');
const forever = require('forever-monitor');

const child = new forever.Monitor('dist/server/src/index.js', {
  silent: false,
  args: [],
  command: 'node --max-old-space-size=6000',
});

child.on('watch:restart', (info) => {
  console.error(`Restarting script because ${info.file} changed`);
});

child.on('restart', () => {
  console.error(`Forever restarting script for ${child.times} time`);
});

child.on('exit:code', (code) => {
  console.error(`Forever detected script exited with code ${code}`);
});

// download initial card definitions
updateCardbase('private', process.env.DATA_BUCKET)
  .then(() => {
    // download ml initial model
    downloadModelsFromS3('', process.env.DATA_BUCKET)
      .then(() => {
        child.start();
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
