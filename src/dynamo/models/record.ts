import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';
import { v4 as uuidv4 } from 'uuid';

import Record, { UnhydratedRecord } from '../../datatypes/Record';
const { getObject, putObject } = require('../s3client');
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

const hydrate = async (document?: UnhydratedRecord): Promise<Record | undefined> => {
  if (!document) {
    return undefined;
  }

  const cards = await getObject(process.env.DATA_BUCKET, `cardlist/${document.id}.json`);

  if (!cards) {
    return undefined;
  }

  return {
    ...document,
    cards: cards,
  } as Record;
};

const dehydrate = async (document: Record): Promise<UnhydratedRecord> => {
  const { cards, ...unhydrated } = document;
  await putObject(process.env.DATA_BUCKET, `cardlist/${document.id}.json`, cards);
  return unhydrated;
};

const batchHydrate = async (documents?: UnhydratedRecord[]): Promise<Record[] | undefined> => {
  if (!documents) {
    return undefined;
  }

  return (await Promise.all(documents.map(hydrate)).then((results) =>
    results.filter((result) => result !== undefined),
  )) as Record[];
};

const fillRequiredDetails = (document: Record): Record => {
  return {
    id: document.id || uuidv4(),
    cube: document.cube,
    date: document.date || Date.now().valueOf(),
    name: document.name,
    description: document.description || '',
    cards: document.cards || [],
    state: document.state || 'playing',
    players: document.players || [],
    matches: document.matches || [],
    trophy: document.trophy || '',
  };
};

const record = {
  getById: async (id: string): Promise<Record | undefined> => hydrate((await client.get(id)).Item as UnhydratedRecord),
  getUnhydrated: async (id: string): Promise<UnhydratedRecord | undefined> =>
    (await client.get(id)).Item as UnhydratedRecord,
  getByCube: async (
    cube: string,
    limit: number,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: Record[]; lastKey?: DocumentClient.Key }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const cubeAttr: keyof UnhydratedRecord = 'cube';

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
      items: await batchHydrate(result.Items as UnhydratedRecord[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: Record): Promise<string> => {
    const filled = fillRequiredDetails(document);
    const dehydrated = await dehydrate(filled);
    client.put(dehydrated);

    return dehydrated.id!;
  },
  delete: async (id: string): Promise<void> => {
    await client.delete({ id });
  },
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
};

module.exports = record;
export default record;
