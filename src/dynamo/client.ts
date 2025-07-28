// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { fromEnv } from '@aws-sdk/credential-providers';

const client = new DynamoDB({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  credentials: fromEnv(),
  region: process.env.AWS_REGION,
});

export default client;
module.exports = client;
