require('module-alias/register');
const { downloadModelsFromS3 } = require('./dist/recommenderService/src/mlutils/downloadModel');
const forever = require('forever-monitor');

const child = new forever.Monitor('dist/recommenderService/src/index.js', {
  silent: false,
  args: [],
  command: 'node --max-old-space-size=2000',
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

// download ml initial model
downloadModelsFromS3('', process.env.DATA_BUCKET || 'cubecobra-data')
  .then(() => {
    child.start();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
