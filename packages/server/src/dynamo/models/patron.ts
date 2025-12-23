// migrated to /daos/PatronDynamoDao.ts

import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { PutCommandOutput } from '@aws-sdk/lib-dynamodb';
import { UnhydratedPatron } from '@utils/datatypes/Patron';
import createClient from 'dynamo/util';

const client = createClient({
  name: 'PATRON',
  partitionKey: 'owner',
  attributes: {
    owner: 'S',
    email: 'S',
  },
  indexes: [
    {
      name: 'ByEmail',
      partitionKey: 'email',
    },
  ],
});

const patron = {
  getById: async (id: string): Promise<UnhydratedPatron> => (await client.get(id)).Item as UnhydratedPatron,
  getByEmail: async (email: string): Promise<UnhydratedPatron | undefined> => {
    const result = await client.query({
      IndexName: 'ByEmail',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
    });
    return result.Items ? (result.Items[0] as UnhydratedPatron) : undefined;
  },
  put: async (document: UnhydratedPatron): Promise<PutCommandOutput> => {
    const now = Date.now();
    const enrichedDocument = {
      ...document,
      dateCreated: document.dateCreated || now,
      dateLastUpdated: now,
    };
    return client.put(enrichedDocument);
  },
  scan: async (
    limit?: number,
    lastKey?: Record<string, any>,
  ): Promise<{ items: any[]; lastKey?: Record<string, any> }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
      Limit: limit,
    });

    return {
      items: result.Items ?? [],
      lastKey: result.LastEvaluatedKey,
    };
  },
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
  deleteById: async (id: string): Promise<void> => client.delete({ owner: id }),
};

module.exports = patron;
export default patron;
