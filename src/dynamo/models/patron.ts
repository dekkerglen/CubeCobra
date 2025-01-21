import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';

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
      sortKey: 'email', //TODO: ???
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
  put: async (document: UnhydratedPatron): Promise<DocumentClient.PutItemInputAttributeMap> => client.put(document),
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
  deleteById: async (id: DocumentClient.Key): Promise<void> => client.delete({ id }),
};
