// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { fromEnv } from '@aws-sdk/credential-providers';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const documentClient = DynamoDBDocument.from(
  new DynamoDB({
    apiVersion: '2012-08-10',
    credentials: fromEnv(),
    endpoint: process.env.AWS_ENDPOINT || undefined,
  }),
  //Equivalent to V2
  {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  },
);

export default documentClient;
module.exports = documentClient;
