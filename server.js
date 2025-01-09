require('module-alias/register');
const { updateCardbase } = require('./build/util/updatecards');
const { downloadFromS3 } = require('./build/util/downloadModel');
const forever = require('forever-monitor');

const child = new forever.Monitor('build/app.js', {
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
updateCardbase().then(() => {
  // download ml initial model
  downloadFromS3().then(() => {
    child.start();
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
