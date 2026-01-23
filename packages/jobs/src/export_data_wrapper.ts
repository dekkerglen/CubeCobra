import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import 'module-alias/register';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { exportTaskDao } from '@server/dynamo/daos';
import { s3 } from '@server/dynamo/s3client';
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Wrapper script for export data jobs that handles task status updates
 * and copies exports to the public bucket when complete.
 */
const runExportDataWrapper = async () => {
  const taskId = process.env.EXPORT_TASK_ID;
  if (!taskId) {
    console.error('EXPORT_TASK_ID environment variable is required');
    process.exit(1);
  }

  try {
    // Update task to "Downloading card data"
    await exportTaskDao.updateStep(taskId, 'Downloading card data');

    // Initialize card database
    const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
    await initializeCardDb(privateDir);

    // Update task to "Exporting cubes"
    await exportTaskDao.updateStep(taskId, 'Exporting cubes');

    // Run cube export
    await execAsync('NODE_OPTIONS=--max_old_space-size=18192 node dist/jobs/src/export_cubes.js', {
      cwd: path.join(__dirname, '..', '..'),
    });

    // Update task to "Exporting decks"
    await exportTaskDao.updateStep(taskId, 'Exporting decks');

    // Run deck export
    await execAsync('node dist/jobs/src/export_decks.js', {
      cwd: path.join(__dirname, '..', '..'),
    });

    // Update task to "Exporting card dictionary"
    await exportTaskDao.updateStep(taskId, 'Exporting card dictionary');

    // Run simple card dict export
    await execAsync('node dist/jobs/src/export_simple_card_dict.js', {
      cwd: path.join(__dirname, '..', '..'),
    });

    // Only upload to public bucket in PROD (skip in BETA)
    const stage = process.env.STAGE || 'BETA';
    if (stage === 'PROD') {
      // Update task to "Uploading to public bucket"
      await exportTaskDao.updateStep(taskId, 'Uploading to public bucket');

      // Copy exports to public bucket
      await copyExportsToPublicBucket();

      // Update task to "Uploading card definitions"
      await exportTaskDao.updateStep(taskId, 'Uploading card definitions');

      // Copy current card definition files to public bucket
      await copyCardDefinitionsToPublicBucket(privateDir);
    } else {
      console.log(`Skipping upload to cubecobra-public (STAGE=${stage})`);
    }

    // Mark task as completed
    await exportTaskDao.markAsCompleted(taskId);

    console.log('✅ Export data job completed successfully');
  } catch (error) {
    console.error('❌ Export data job failed:', error);

    // Mark task as failed
    await exportTaskDao.markAsFailed(
      taskId,
      `Export failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    process.exit(1);
  }
};

/**
 * Copy export files to the public CubeCobra bucket
 */
const copyExportsToPublicBucket = async () => {
  const publicBucket = 'cubecobra-public';
  const exportDir = './temp/export';

  if (!fs.existsSync(exportDir)) {
    throw new Error('Export directory does not exist');
  }

  // Get all files in export directory recursively
  const getAllFiles = (dir: string, baseDir: string = dir): string[] => {
    const files: string[] = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(baseDir, fullPath);

      if (fs.statSync(fullPath).isDirectory()) {
        files.push(...getAllFiles(fullPath, baseDir));
      } else {
        files.push(relativePath);
      }
    }

    return files;
  };

  const files = getAllFiles(exportDir);

  for (const file of files) {
    const filePath = path.join(exportDir, file);
    const fileContent = fs.readFileSync(filePath);
    const s3Key = `exports/${file.replace(/\\/g, '/')}`; // Normalize path separators

    console.log(`Uploading ${file} to s3://${publicBucket}/${s3Key}`);

    // Use S3 client directly for binary data
    await s3.putObject({
      Bucket: publicBucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: file.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    });
  }
};

/**
 * Copy current card definition files to the public bucket
 */
const copyCardDefinitionsToPublicBucket = async (privateDir: string) => {
  const publicBucket = 'cubecobra-public';

  // List of card definition files to copy
  const cardFiles = [
    'carddict.json',
    'cardimages.json',
    'cardtree.json',
    'comboDict.json',
    'comboTree.json',
    'cubeEmbeddings.json',
    'english.json',
    'full_names.json',
    'imagedict.json',
    'indexToOracle.json',
    'metadatadict.json',
    'nameToId.json',
    'names.json',
    'oracleToId.json',
  ];

  for (const fileName of cardFiles) {
    const filePath = path.join(privateDir, fileName);

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath);
      const s3Key = fileName;

      console.log(`Uploading ${fileName} to s3://${publicBucket}/${s3Key}`);

      // Use S3 client directly for binary data
      await s3.putObject({
        Bucket: publicBucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'application/json',
      });
    } else {
      console.warn(`Card definition file not found: ${fileName}`);
    }
  }
};

// Run the wrapper if this script is executed directly
if (require.main === module) {
  runExportDataWrapper()
    .then(() => {
      console.log('🎉 Export data wrapper completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Export data wrapper failed:', error);
      process.exit(1);
    });
}

export { runExportDataWrapper };
