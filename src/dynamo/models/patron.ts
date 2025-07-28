import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { PutCommandOutput } from '@aws-sdk/lib-dynamodb';

import { UnhydratedPatron } from '../../datatypes/Patron';
import createClient from '../util';

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

module.exports = {
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
  put: async (document: UnhydratedPatron): Promise<PutCommandOutput> => client.put(document),
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
  deleteById: async (id: string): Promise<void> => client.delete({ owner: id }),
};
