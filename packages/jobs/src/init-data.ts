/**
 * Initialize card data and ML models for jobs by downloading from S3
 * This should be run once before executing any jobs that require card data or ML models
 */
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';

dotenv.config({ path: path.resolve(process.cwd(), 'packages', 'jobs', '.env') });

import { downloadModelsFromS3 } from '@server/serverutils/downloadModel';
import { updateCardbase } from '@server/serverutils/updatecards';
import fs from 'fs';

(async () => {
  try {
    console.log('Initializing card data and ML models for jobs...');

    const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
    const serverDir = path.join(__dirname, '..', '..', 'server');

    // Ensure directories exist
    if (!fs.existsSync(privateDir)) {
      console.log(`Creating directory: ${privateDir}`);
      fs.mkdirSync(privateDir, { recursive: true });
    }

    // Download card data from S3
    console.log('Downloading card data from S3...');
    await updateCardbase(privateDir);
    console.log('✅ Card data downloaded');

    // Download ML models from S3
    console.log('Downloading ML models from S3...');
    await downloadModelsFromS3(serverDir);
    console.log('✅ ML models downloaded');

    console.log('✅ Initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize data:', error);
    process.exit(1);
  }
})();
