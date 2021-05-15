/* eslint-disable no-await-in-loop */

// Load Environment Variables
require('dotenv').config();
const AWS = require('aws-sdk');
const carddb = require('../serverjs/cards.js');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

try {
  (async () => {
    await carddb.initializeCardDb();

    for (const [file, object] of Object.entries(carddb.fileToAttribute)) {
      const params = {
        Bucket: 'cubecobra',
        Key: `cards/${file}`,
        Body: JSON.stringify(carddb[object]),
      };
      await s3.upload(params).promise();

      console.log(`Finished ${file}`);
    }

    const params = {
      Bucket: 'cubecobra',
      Key: `cards/manifest.json`,
      Body: JSON.stringify({ date_exported: new Date() }),
    };
    await s3.upload(params).promise();

    console.log('done');
    process.exit();
  })();
} catch (err) {
  console.error(err);
  process.exit();
}
