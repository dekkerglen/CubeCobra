// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const client = new DynamoDB({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5000,
    socketTimeout: 5000,
    httpsAgent: {
      maxSockets: 200, // Increase from default 50
    },
    socketAcquisitionWarningTimeout: 0, // Disable socket acquisition warnings
  }),
});

export default client;
module.exports = client;
