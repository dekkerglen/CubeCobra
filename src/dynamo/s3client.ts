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

const getObject = async (bucket: string, key: string): Promise<any> => {
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

const putObject = async (bucket: string, key: string, value: any): Promise<void> => {
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
