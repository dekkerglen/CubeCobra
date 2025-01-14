// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import AWS from 'aws-sdk';

import { get, invalidate, put } from './cache';

// Load the AWS SDK for Node.js

// Set the region
AWS.config.update({
  s3ForcePathStyle: !!process.env.AWS_ENDPOINT,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
});

const getObject = async (bucket: string, key: string, skipcache = false): Promise<any> => {
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

    const value = JSON.parse(res!.Body!.toString());

    // Update cache
    await put(key, value);

    return value;
  } catch {
    return null;
  }
};

const putObject = async (bucket: string, key: string, value: any): Promise<void> => {
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

const deleteObject = async (bucket: string, key: string): Promise<void> => {
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
