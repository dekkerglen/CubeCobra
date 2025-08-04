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

    fs.writeFileSync(file.Key, await res.Body.transformToString());
    // eslint-disable-next-line no-console -- Debugging
    console.log(`Downloaded ${file.Key}`);
  }
};

module.exports = {
  downloadFromS3,
};
