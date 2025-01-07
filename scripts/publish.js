const fs = require('fs');
const AWS = require('aws-sdk');
const archiver = require('archiver');
require('dotenv').config();

// get version from package.json
const VERSION = require('../package.json').version;

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

/* Test */
const bucketName = 'cubecobra';   
const zipFileName = `builds/${VERSION}.zip`;

const output = fs.createWriteStream('target.zip');
const archive = archiver('zip');

// first we delete the zip file if it exists

if (fs.existsSync('target.zip')) {
  fs.unlinkSync('target.zip');
}

output.on('close', function () {
  console.log(`${archive.pointer()} total bytes`);
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

// List of files or directories to ignore
const ignore = [
  '**/node_modules/**',
  'target.zip',
  'upload.js',
  '.env',
  '.gitignore',
  '.git/**',
  'test/**',
  'scripts/**',
  'model/**',
  'scripts/**',
  'scripts/**',
  'temp/**',
  'private/**',
  'publish.js',
  'README.md',
];

// append files from a sub-directory, putting its contents at the root of archive
archive.glob('**/*', { ignore, dot: true });

archive.finalize();
