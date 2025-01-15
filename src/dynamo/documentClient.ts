// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

// Load the AWS SDK for Node.js
import AWS from 'aws-sdk';

// Set the region
AWS.config.update({
  s3ForcePathStyle: !!process.env.AWS_ENDPOINT,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const documentClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  endpoint: process.env.AWS_ENDPOINT || undefined,
});

export default documentClient;
module.exports = documentClient;
