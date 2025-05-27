import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';
import { v4 as uuidv4 } from 'uuid';

import Record from '../../datatypes/Record';
import createClient from '../util';

const client = createClient({
  name: 'RECORD',
  partitionKey: 'id',
  attributes: {
    cube: 'S',
    date: 'N',
    id: 'S',
  },
  indexes: [
    {
      name: 'ByCube',
      partitionKey: 'cube',
      sortKey: 'date',
    },
  ],
});

const fillRequiredDetails = (document: Record): Record => {
  return {
    id: document.id || uuidv4(),
    cube: document.cube,
    date: document.date || Date.now().valueOf(),
    name: document.name,
    description: document.description || '',
    players: document.players || [],
    matches: document.matches || [],
    trophy: document.trophy || '',
    draft: document.draft,
  };
};

const record = {
  getById: async (id: string): Promise<Record | undefined> => (await client.get(id)).Item as Record,
  getByCube: async (
    cube: string,
    limit: number,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: Record[]; lastKey?: DocumentClient.Key }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const cubeAttr: keyof Record = 'cube';

    const result = await client.query({
      IndexName: 'ByCube',
      KeyConditionExpression: `#p1 = :cube`,
      ExpressionAttributeValues: {
        ':cube': cube,
      },
      ExpressionAttributeNames: {
        '#p1': cubeAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: limit || 36,
    });
    return {
      items: result.Items as Record[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: Record): Promise<string> => {
    const filled = fillRequiredDetails(document);
    client.put(filled);

    return filled.id!;
  },
  delete: async (id: string): Promise<void> => {
    await client.delete({ id });
  },
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
};

module.exports = record;
export default record;
