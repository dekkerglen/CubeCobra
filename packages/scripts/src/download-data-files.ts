import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from the scripts package .env file
config({ path: path.join(__dirname, '..', '.env') });

// Import the download functions
import { updateCardbase } from '@server/serverutils/updatecards';

import { downloadModelsFromS3 } from '../../recommenderService/src/mlutils/downloadModel';
import { updateCardbase as updateRecommenderCardbase } from '../../recommenderService/src/mlutils/updateCards';

/**
 * Download essential data files for CubeCobra development
 *
 * This script downloads card definitions and ML model files from the public
 * S3 bucket (cubecobra-public) to help new contributors get started quickly.
 *
 * Safety:
 * ✅ Safe to run - downloads from a public S3 bucket
 * ✅ No AWS credentials required
 * ✅ No LocalStack configuration needed
 *
 * Downloads:
 * - Card definitions (~100MB) -> /packages/server/private/
 * - Card definitions (~100MB) -> /packages/recommenderService/private/
 * - ML model files (~500MB) -> /packages/recommenderService/model/
 *
 * This is only needed once during initial setup.
 */
const downloadDataFiles = async () => {
  console.log('Downloading card data files from public S3 bucket (cubecobra-public)...');
  console.log('✅ Safe to run - no credentials required\n');

  // Define target directories in the monorepo structure
  const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
  const recommenderPrivateDir = path.join(__dirname, '..', '..', 'recommenderService', 'private');
  const recommenderDir = path.join(__dirname, '..', '..', 'recommenderService');

  // Ensure directories exist
  if (!fs.existsSync(privateDir)) {
    fs.mkdirSync(privateDir, { recursive: true });
  }
  if (!fs.existsSync(recommenderPrivateDir)) {
    fs.mkdirSync(recommenderPrivateDir, { recursive: true });
  }
  if (!fs.existsSync(recommenderDir)) {
    fs.mkdirSync(recommenderDir, { recursive: true });
  }

  try {
    // Download card definitions to /packages/server/private
    console.log('Downloading card definitions to server package...');
    await updateCardbase(privateDir, 'cubecobra-public');

    // Download card definitions to /packages/recommenderService/private
    console.log('Downloading card definitions to recommender service package...');
    await updateRecommenderCardbase(recommenderPrivateDir, 'cubecobra-public');

    // Download ML model files to /packages/recommenderService
    console.log('Downloading ML model files...');
    await downloadModelsFromS3(recommenderDir, 'cubecobra-public');

    console.log('✅ Data files downloaded successfully!');
    console.log(`📁 Server card data: ${privateDir}`);
    console.log(`📁 Recommender card data: ${recommenderPrivateDir}`);
    console.log(`🤖 ML models: ${path.join(recommenderDir, 'model')}`);
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
