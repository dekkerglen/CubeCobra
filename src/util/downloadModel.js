require('dotenv').config();
const fs = require('fs');

const { S3 } = require('@aws-sdk/client-s3');
const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');

const s3 = new S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
});

const downloadFromS3 = async () => {
  // list all from s3 under s3://cubecobra/model
  const listResult = await s3.listObjectsV2({ Bucket: process.env.DATA_BUCKET, Prefix: 'model/' });

  // for each file, download it to the local model directory
  for (const file of listResult.Contents) {
    const res = await s3.getObject({ Bucket: process.env.DATA_BUCKET, Key: file.Key });

    // make sure folders exist
    const folders = file.Key.split('/');
    folders.pop();

    let folderPath = '';
    for (const folder of folders) {
      folderPath += `${folder}/`;
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
    }

    //Models are a mix of JSON and binary, can't simply call res.Body.transformToString
    if (res.Body) {
      // Create a writable stream to the local file
      const fileStream = fs.createWriteStream(file.Key);

      // Pipe the S3 object's Body (readable stream) to the file stream
      await new Promise((resolve, reject) => {
        res.Body.pipe(fileStream)
          .on('error', (err) => reject(err))
          .on('close', () => resolve()); // 'close' event indicates the stream has finished writing
      });

      // eslint-disable-next-line no-console -- Debugging
      console.log(`Downloaded ${file.Key}`);
    } else {
      // eslint-disable-next-line no-console -- Debugging
      console.error('S3 object body is empty.');
    }
  }
};

module.exports = {
  downloadFromS3,
};
