require('dotenv').config();
const fs = require('fs');

import { s3 } from '../dynamo/s3client';

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

    fs.writeFileSync(file.Key, res.Body);
    // eslint-disable-next-line no-console -- Debugging
    console.log(`Downloaded ${file.Key}`);
  }
};

module.exports = {
  downloadFromS3,
};
