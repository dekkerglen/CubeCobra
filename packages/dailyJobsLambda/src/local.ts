// Local runner for daily jobs lambda
// Run with: npm run local
const path = require('path');

// Load .env from the dailyJobsLambda directory (or parent directories)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Also try loading from the root of the repo if not found
if (!process.env.DYNAMO_TABLE) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

// Verify required environment variables are set
if (!process.env.DYNAMO_TABLE) {
  console.error('\n✗ Error: DYNAMO_TABLE environment variable is not set');
  console.error('Please create a .env file in packages/dailyJobsLambda/ or the repo root with:');
  console.error('  DYNAMO_TABLE=your-table-name');
  process.exit(1);
}

const run = async () => {
  console.log('Running daily jobs lambda locally...\n');
  console.log(`Using DynamoDB table: ${process.env.DYNAMO_TABLE}\n`);

  try {
    // Import the built handler from dist (after env vars are loaded)
    const { handler } = require('../dist/handler');

    // Pass a mock event with skipWeekly flag to avoid queue rotation errors in local testing
    const result = await handler({ skipWeekly: true });
    console.log('\n✓ Lambda execution completed');
    console.log('Result:', JSON.parse(result.body));
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Lambda execution failed:', err);
    process.exit(1);
  }
};

run();
