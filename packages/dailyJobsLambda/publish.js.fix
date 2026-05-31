const fs = require('fs');
const archiver = require('archiver');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// get version from environment variable (for CI/CD) or root package.json (for local dev)
const VERSION = process.env.LAMBDA_VERSION || require('../../package.json').version;

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

const bucketName = process.env.CUBECOBRA_APP_BUCKET || 'cubecobra';
const zipFileName = `dailyJobsLambda/${VERSION}.zip`;

const output = fs.createWriteStream('target.zip');
const archive = archiver('zip');

// first we delete the zip file if it exists
if (fs.existsSync('target.zip')) {
  fs.unlinkSync('target.zip');
}

output.on('close', async function () {
  console.log(archive.pointer() + ' total bytes');
  console.log('archiver has been finalized and the output file descriptor has closed.');

  // upload the zip file to s3
  try {
    const body = fs.readFileSync('target.zip');
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: zipFileName,
        Body: body,
      }),
    );
    console.log(`Upload Success: s3://${bucketName}/${zipFileName}`);
  } catch (err) {
    console.log('Error', err);
    process.exit(1);
  }
});

archive.on('error', function (err) {
  throw err;
});

archive.pipe(output);

// append files from the ./dist directory, putting its contents at the root of archive
archive.directory('dist/', false);

archive.finalize();
