import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

import Client from './client';

const documentClient = DynamoDBDocument.from(
  Client,
  //Equivalent to V2
  {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
      convertTopLevelContainer: true,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  },
);

export default documentClient;
module.exports = documentClient;
