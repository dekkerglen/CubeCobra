// Load Environment Variables
require('dotenv').config();

// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

AWS.config.update({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  s3ForcePathStyle: !!process.env.AWS_ENDPOINT,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

module.exports = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
