import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue, PutCommandOutput } from '@aws-sdk/lib-dynamodb';
import Notification, { NewNotification, NotificationStatus } from '@utils/datatypes/Notification';
import createClient from 'dynamo/util';

const client = createClient({
  name: 'NOTIFICATIONS',
  partitionKey: 'id',
  attributes: {
    id: 'S',
    date: 'N',
    toStatusComp: 'S',
    to: 'S',
  },
  indexes: [
    {
      partitionKey: 'to',
      sortKey: 'date',
      name: 'ByTo',
    },
    {
      partitionKey: 'toStatusComp',
      sortKey: 'date',
      name: 'ByToStatusComp',
    },
  ],
});

const notification = {
  getById: async (id: string): Promise<Notification> => (await client.get(id)).Item as Notification,
  getByToAndStatus: async (
    to: string,
    status: NotificationStatus,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: Notification[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const toStatusCompAttr: keyof Notification = 'toStatusComp';

    const result = await client.query({
      IndexName: 'ByToStatusComp',
      KeyConditionExpression: `#p1 = :tscomp`,
      ExpressionAttributeValues: {
        ':tscomp': `${to}:${status}`,
      },
      ExpressionAttributeNames: {
        '#p1': toStatusCompAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: result.Items as Notification[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByTo: async (
    to: string,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: Notification[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    const toAttr: keyof Notification = 'to';

    const result = await client.query({
      IndexName: 'ByTo',
      KeyConditionExpression: `#p1 = :to`,
      ExpressionAttributeValues: {
        ':to': `${to}`,
      },
      ExpressionAttributeNames: {
        '#p1': toAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: result.Items as Notification[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  update: async (document: Notification): Promise<PutCommandOutput> => {
    if (!document.id) {
      throw new Error('Invalid document: No partition key provided');
    }
    document.toStatusComp = `${document.to}:${document.status}`;
    return client.put(document);
  },
  put: async (document: NewNotification): Promise<PutCommandOutput> => {
    const notification = {
      ...document,
      toStatusComp: `${document.to}:${NotificationStatus.UNREAD}`,
      status: NotificationStatus.UNREAD,
    } as NewNotification;

    //put generates the id for the notification automatically
    return client.put(notification);
  },
  batchPut: async (documents: Notification[]) =>
    client.batchPut(
      documents.map((item) => ({
        ...item,
        toStatusComp: `${item.to}:${item.status}`,
      })),
    ),
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
};

module.exports = notification;

export default notification;
