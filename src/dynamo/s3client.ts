// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import AWS from 'aws-sdk';

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

export const getObject = async (bucket: string, key: string): Promise<any> => {
  try {
    const res = await s3
      .getObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();

    return JSON.parse(res!.Body!.toString());
  } catch {
    return null;
  }
};

export const putObject = async (bucket: string, key: string, value: any): Promise<void> => {
  await s3
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value),
    })
    .promise();
};

export const deleteObject = async (bucket: string, key: string): Promise<void> => {
  await s3
    .deleteObject({
      Bucket: bucket,
      Key: key,
    })
    .promise();
};

export const getBucketName = (): string => {
  //So S3 actions don't complain that an environment variable could be undefined
  if (!process.env.DATA_BUCKET) {
    throw new Error('Bucket is not set');
  }
  return process.env.DATA_BUCKET;
};

module.exports = {
  getObject,
  putObject,
  deleteObject,
  getBucketName,
};
