const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const BUCKET_NAME = process.env.CUBECOBRA_APP_BUCKET || 'cubecobra';
const VERSION = process.env.LAMBDA_VERSION || require('../../package.json').version;

if (!BUCKET_NAME) {
  console.error('CUBECOBRA_APP_BUCKET environment variable is required');
  process.exit(1);
}

async function createZip() {
  const output = fs.createWriteStream(path.join(__dirname, 'dist.zip'));
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory('dist/', false);
    archive.finalize();
  });
}

async function uploadToS3() {
  const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const zipPath = path.join(__dirname, 'dist.zip');
  const fileContent = fs.readFileSync(zipPath);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: `cardUpdateMonitorLambda/${VERSION}.zip`,
    Body: fileContent,
  });

  await s3Client.send(command);
  console.log(`Uploaded to s3://${BUCKET_NAME}/cardUpdateMonitorLambda/${VERSION}.zip`);
}

async function main() {
  console.log('Creating zip file...');
  await createZip();
  console.log('Zip file created');

  console.log('Uploading to S3...');
  await uploadToS3();
  console.log('Upload complete');

  // Clean up
  fs.unlinkSync(path.join(__dirname, 'dist.zip'));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
