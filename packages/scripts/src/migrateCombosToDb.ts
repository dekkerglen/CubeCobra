import { config } from 'dotenv';
import https from 'https';
import path from 'path';
import zlib from 'zlib';

// Load environment variables from the scripts package .env file
config({ path: path.join(__dirname, '..', '.env') });

import { comboDao } from '@server/dynamo/daos';
import { Combo } from '@utils/datatypes/CardCatalog';

/**
 * Migrate combo data to DynamoDB
 *
 * This script downloads combo data from Commander Spellbook API and
 * pushes it to DynamoDB using the ComboDynamoDao.
 *
 * Requirements:
 * - AWS credentials configured (for DynamoDB access)
 * - LocalStack running (for local development) or AWS access for production
 *
 * Usage:
 *   npm run migrate-combos
 */

const fetchWithRetries = async (url: string, retries = 5, delay = 60000): Promise<any> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise<any>((resolve, reject) => {
        const timeout = 300000; // 5 minute timeout for slow server

        const request = https.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to fetch data: ${response.statusCode}`));
            return;
          }

          const isGzipped = url.endsWith('.gz');
          const chunks: Buffer[] = [];

          response.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          response.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks);
              let rawData: string;

              if (isGzipped) {
                // Decompress gzip data
                rawData = zlib.gunzipSync(buffer).toString('utf-8');
              } else {
                rawData = buffer.toString('utf-8');
              }

              const parsedData = JSON.parse(rawData);
              resolve(parsedData);
            } catch (err) {
              reject(err);
            }
          });
        });

        request.setTimeout(timeout, () => {
          request.destroy();
          reject(new Error(`Request timeout after ${timeout}ms`));
        });

        request.on('error', (err) => {
          reject(err);
        });
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Attempt ${attempt} failed: ${error.message}`);
      } else {
        console.error(`Attempt ${attempt} failed with an unknown error:`, error);
      }
      if (attempt < retries) {
        // For the last retry before giving up, wait 5 minutes
        const backoff = attempt === retries - 1 ? 300000 : delay * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch data after ${retries} attempts: ${error.message}`);
        } else {
          throw new Error(`Failed to fetch data after ${retries} attempts: Unknown error`);
        }
      }
    }
  }
};

const migrateCombos = async () => {
  console.log('='.repeat(80));
  console.log('Combo Data Migration to DynamoDB');
  console.log('='.repeat(80));
  console.log('');

  const COMMANDER_SPELLBOOK_URL = 'https://json.commanderspellbook.com/variants.json.gz';

  try {
    // Fetch combo data
    console.log('Fetching combo data from Commander Spellbook...');
    console.log(`URL: ${COMMANDER_SPELLBOOK_URL}`);
    console.log('');

    const data = await fetchWithRetries(COMMANDER_SPELLBOOK_URL);

    // The response might be an array directly, or an object with results/variants property
    let variants: any[];
    if (Array.isArray(data)) {
      variants = data;
    } else if (data && Array.isArray(data.results)) {
      variants = data.results;
    } else if (data && Array.isArray(data.variants)) {
      variants = data.variants;
    } else {
      console.error('Unexpected response structure:', JSON.stringify(data).substring(0, 500));
      throw new Error('Invalid response: expected an array or object with variants/results property');
    }

    console.log(`✓ Retrieved ${variants.length} variants`);
    console.log('');

    // Prepare combos for DynamoDB
    console.log('Preparing combos for DynamoDB...');
    const combos: Combo[] = [];
    const now = Date.now();

    for (const variant of variants) {
      if (!variant || !variant.id || !variant.uses) {
        continue;
      }

      // Add timestamp fields if not present
      if (!variant.dateCreated) {
        variant.dateCreated = now;
      }
      variant.dateLastUpdated = now;

      combos.push(variant as Combo);
    }

    console.log(`✓ Prepared ${combos.length} combos`);
    console.log('');

    // Write to DynamoDB
    console.log('Writing combos to DynamoDB...');
    console.log('This may take several minutes depending on the number of combos...');
    console.log('');

    const startTime = Date.now();
    let lastProgressUpdate = Date.now();

    // Batch write with delay to avoid overwhelming DynamoDB
    const WRITE_DELAY_MS = 100; // 100ms delay between batches
    await comboDao.batchPutCombos(combos, WRITE_DELAY_MS, (current, total) => {
      const now = Date.now();
      // Update progress every 2 seconds or on completion
      if (now - lastProgressUpdate > 2000 || current === total) {
        const percent = ((current / total) * 100).toFixed(1);
        const elapsed = (now - startTime) / 1000;
        const rate = current / elapsed;
        const remaining = (total - current) / rate;
        console.log(
          `  Progress: ${current}/${total} (${percent}%) - ` +
          `${rate.toFixed(1)} combos/sec - ` +
          `ETA: ${remaining.toFixed(0)}s`,
        );
        lastProgressUpdate = now;
      }
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log('');
    console.log(`✓ Successfully wrote ${combos.length} combos to DynamoDB`);
    console.log(`  Duration: ${duration.toFixed(2)}s`);
    console.log(`  Average: ${(duration / combos.length * 1000).toFixed(2)}ms per combo`);
    console.log('');
    console.log('='.repeat(80));
    console.log('Migration completed successfully!');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('ERROR: Migration failed');
    console.error('='.repeat(80));
    console.error('');
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
    console.error('');
    process.exit(1);
  }
};

// Run the migration
migrateCombos();
