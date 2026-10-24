require('module-alias/register');
const { loadSecretsFromSsm } = require('./dist/utils/src/ssmSecrets');
const { updateCardbase } = require('./dist/server/src/serverutils/updatecards');
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

// Secrets come from SSM Parameter Store in deployed environments (SSM_SECRETS_PREFIX /
// SSM_SECRET_NAMES). They must be in process.env before the child starts: forever passes this
// process's environment to it. Any failure stops startup so a misconfigured deploy rolls back.
loadSecretsFromSsm()
  .then(({ loaded, skipped }) => {
    if (loaded.length > 0 || skipped.length > 0) {
      console.log(`Loaded ${loaded.length} secret(s) from SSM; optional and absent: ${skipped.join(', ') || 'none'}`);
    }
  })
  // download initial card definitions
  .then(() => updateCardbase('private', process.env.DATA_BUCKET))
  .then(() => {
    // ML models are now handled by the recommender service
    console.log('Starting server (ML service is separate)');
    child.start();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
