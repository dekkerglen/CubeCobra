require('module-alias/register');
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

// Card data is now downloaded during pre-deployment via .platform/hooks/predeploy
// This allows the server to start immediately without 502 errors
console.log('Starting server (card data pre-loaded, ML service is separate)');
child.start();
