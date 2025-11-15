import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

import Client from './client';

const documentClient = DynamoDBDocument.from(
  Client,
  //Equivalent to V2
  {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  },
);

export default documentClient;
module.exports = documentClient;
