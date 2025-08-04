require('dotenv').config();
const fs = require('fs');

import { s3 } from '../dynamo/s3client';
import { fileToAttribute, loadAllFiles } from './cardCatalog';

const downloadFromS3 = async (basePath = 'private') => {
  await Promise.all(
    Object.keys(fileToAttribute).map(async (file) => {
      const res = await s3.getObject({
        Bucket: process.env.DATA_BUCKET,
        Key: `cards/${file}`,
      });
      await fs.writeFileSync(`${basePath}/${file}`, await res.Body.transformToString());
    }),
  );
};

async function updateCardbase(basePath = 'private', defaultPath = null, allPath = null) {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath);
  }

  await downloadFromS3(basePath, defaultPath, allPath);
  await loadAllFiles();
}

module.exports = {
  updateCardbase,
};
