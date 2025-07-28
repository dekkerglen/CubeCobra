const fs = require('fs');

const { Upload } = require('@aws-sdk/lib-storage');

const archiver = require('archiver');
require('dotenv').config();

import { s3 } from '../src/dynamo/s3client';

// get version from package.json
const VERSION = require('../package.json').version;

const bucketName = process.env.CUBECOBRA_APP_BUCKET || 'cubecobra';
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
  fileStream.on('open', async function () {
    const params = {
      Bucket: bucketName,
      Key: zipFileName,
      Body: fileStream,
    };
    await new Upload({
      client: s3,
      params,
    })
      .done()
      .then((data) => {
        console.log('Upload Success', data.Location);
      })
      .catch((err) => {
        console.log('Error', err);
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
  'model/**',
  'temp/**',
  'private/**',
  'src/**',
  'publish.js',
  'README.md',
];

// append files from a sub-directory, putting its contents at the root of archive
archive.glob('**/*', { ignore, dot: true });

archive.finalize();
