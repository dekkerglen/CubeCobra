// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';

// Create a reusable HTTPS agent with increased socket limit
const httpsAgent = new https.Agent({
  maxSockets: 500, // Increase from default 50 to handle large batch operations
  keepAlive: true,
  keepAliveMsecs: 1000,
});

const client = new DynamoDB({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 15000, // Increased from 5000 to handle bulk operations
    socketTimeout: 30000, // Increased from 5000 to handle bulk operations
    httpsAgent,
    socketAcquisitionWarningTimeout: 60000, // Increase warning timeout to 60 seconds
  }),
  maxAttempts: 3, // Retry up to 3 times (default is 3)
  retryMode: 'adaptive', // Use adaptive retry mode for better handling of throttling
});

export default client;
