import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from the scripts package .env file
config({ path: path.join(__dirname, '..', '.env') });

// Import the download functions from server package
import { downloadModelsFromS3 } from '@server/serverutils/downloadModel';
import { updateCardbase } from '@server/serverutils/updatecards';

const downloadDataFiles = async () => {
  console.log('Downloading card data files...');

  // Define target directories in the monorepo structure
  const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
  const modelDir = path.join(__dirname, '..', '..', 'server');

  // Ensure directories exist
  if (!fs.existsSync(privateDir)) {
    fs.mkdirSync(privateDir, { recursive: true });
  }
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  try {
    // Download card definitions to /packages/server/private
    console.log('Downloading card definitions...');
    await updateCardbase(privateDir);

    // Download ML model files to /packages/server/model
    console.log('Downloading ML model files...');
    await downloadModelsFromS3(modelDir);

    console.log('✅ Data files downloaded successfully!');
    console.log(`📁 Card data: ${privateDir}`);
    console.log(`🤖 ML models: ${modelDir}`);
  } catch (error) {
    console.error('❌ Error downloading data files:', error);
    process.exit(1);
  }
};

// Run the download if this script is executed directly
if (require.main === module) {
  downloadDataFiles()
    .then(() => {
      console.log('🎉 Initial data setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

export { downloadDataFiles };
