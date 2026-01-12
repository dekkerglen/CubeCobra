const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');
require('dotenv').config();

// get version from environment variable (for CI/CD) or root package.json (for local dev)
const VERSION = process.env.LAMBDA_VERSION || require('../../package.json').version;

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.CUBECOBRA_APP_BUCKET || 'cubecobra';
const zipFileName = `dailyJobsLambda/${VERSION}.zip`;

var output = fs.createWriteStream('target.zip');
var archive = archiver('zip');

// first we delete the zip file if it exists

if (fs.existsSync('target.zip')) {
  fs.unlinkSync('target.zip');
}

output.on('close', function () {
  console.log(archive.pointer() + ' total bytes');
  console.log('archiver has been finalized and the output file descriptor has closed.');

  // upload the zip file to s3
  const fileStream = fs.createReadStream('target.zip');
  fileStream.on('open', function () {
    const params = {
      Bucket: bucketName,
      Key: zipFileName,
      Body: fileStream,
    };
    s3.upload(params, function (err, data) {
      if (err) {
        console.log('Error', err);
      }
      if (data) {
        console.log('Upload Success', data.Location);
      }
    });
  });
});

archive.on('error', function (err) {
  throw err;
});

archive.pipe(output);

// append files from the ./dist directory, putting its contents at the root of archive
archive.directory('dist/', false);

archive.finalize();
