// Load Environment Variables
require('dotenv').config();

const AWS = require('aws-sdk');
const { get, put, invalidate } = require('./cache');

// Load the AWS SDK for Node.js

// Set the region
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-2',
});

const s3 = new AWS.S3();

const getObject = async (bucket, key, skipcache = false) => {
  try {
    // Check cache
    const cached = get(key);

    if (cached && !skipcache) {
      return cached;
    }

    const res = await s3
      .getObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
    const value = JSON.parse(res.Body.toString());

    // Update cache
    await put(key, value);

    return value;
  } catch {
    return null;
  }
};

const putObject = async (bucket, key, value) => {
  // Update cache
  await invalidate(key);
  put(key, value);

  await s3
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value),
    })
    .promise();
};

const deleteObject = async (bucket, key) => {
  await s3
    .deleteObject({
      Bucket: bucket,
      Key: key,
    })
    .promise();
};

module.exports = {
  getObject,
  putObject,
  deleteObject,
};
