require('module-alias/register');
const { loadSecretsFromSsm } = require('./dist/utils/src/ssmSecrets.js');
const { downloadModelsFromS3 } = require('./dist/recommenderService/src/mlutils/downloadModel.js');
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

// Secrets come from SSM Parameter Store in deployed environments (SSM_SECRETS_PREFIX /
// SSM_SECRET_NAMES) and must be in process.env before forever starts the child.
loadSecretsFromSsm()
  .then(({ loaded }) => {
    if (loaded.length > 0) {
      console.log(`Loaded ${loaded.length} secret(s) from SSM`);
    }
  })
  // download ml initial model
  .then(() => downloadModelsFromS3('', process.env.DATA_BUCKET || 'cubecobra-data'))
  .then(() => {
    child.start();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
