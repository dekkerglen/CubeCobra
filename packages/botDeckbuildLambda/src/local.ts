// Local runner for the bot-deckbuild lambda.
// Run with: npm run local -- <draftId>
// Requires DATA_BUCKET, DYNAMO_TABLE, ML_SERVICE_URL (and AWS creds) in the environment / .env.
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.DYNAMO_TABLE) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

for (const required of ['DATA_BUCKET', 'DYNAMO_TABLE', 'ML_SERVICE_URL']) {
  if (!process.env[required]) {
    console.error(`\n✗ Error: ${required} environment variable is not set`);
    process.exit(1);
  }
}

const draftId = process.argv[2];
if (!draftId) {
  console.error('\n✗ Usage: npm run local -- <draftId>');
  process.exit(1);
}

const run = async () => {
  console.log(`Building bot decks for draft ${draftId} locally...\n`);
  try {
    const { handler } = require('../dist/handler');
    const result = await handler({
      Records: [{ messageId: 'local-1', body: JSON.stringify({ draftId }) }],
    });
    console.log('\n✓ Lambda execution completed');
    console.log('Result:', JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Lambda execution failed:', err);
    process.exit(1);
  }
};

run();
