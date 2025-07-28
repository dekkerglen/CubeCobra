import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

import { NewNotice, Notice, NoticeStatus, UnhydratedNotice } from '../../datatypes/Notice';
import UserType from '../../datatypes/User';
import createClient from '../util';
const User = require('./user');

const client = createClient({
  name: 'NOTICES',
  partitionKey: 'id',
  attributes: {
    id: 'S',
    date: 'N',
    status: 'S',
  },
  indexes: [
    {
      partitionKey: 'status',
      sortKey: 'date',
      name: 'ByStatus',
    },
  ],
});

const createHydratedNotice = (document: UnhydratedNotice, user: UserType): Notice => {
  return {
    ...document,
    id: document.id!,
    user: user,
  };
};

const hydrate = async (notice: UnhydratedNotice): Promise<Notice> => {
  if (!notice) {
    return notice;
  }

  const user = await User.getById(notice.user);
  return createHydratedNotice(notice, user);
};

const batchHydrate = async (notices: UnhydratedNotice[]): Promise<Notice[]> => {
  const users: UserType[] = await User.batchGet(notices.map((notice) => notice.user));

  return notices
    .map((notice) => {
      const user = users.find((user) => user.id === notice.user);

      //So typescript is happy, we will handle the user not found and filter those notices out from the end result
      if (!user) {
        return null;
      }

      return createHydratedNotice(notice, user);
    })
    .filter((n) => n !== null);
};

//Use as type guard since NewNotice doesn't have status but Notice does, and both can be put()
const getStatus = (document: NewNotice | Notice): NoticeStatus => {
  // eslint-disable-next-line no-restricted-syntax -- Backend code, can be sure this syntax works
  if ('status' in document) {
    return document.status;
  } else {
    return NoticeStatus.ACTIVE;
  }
};

const notice = {
  getById: async (id: string): Promise<Notice> => hydrate((await client.get(id)).Item as UnhydratedNotice),
  getByStatus: async (
    to: string,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: Notice[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const statusAttr: keyof UnhydratedNotice = 'status';

    const result = await client.query({
      IndexName: 'ByStatus',
      KeyConditionExpression: `#p1 = :to`,
      ExpressionAttributeValues: {
        ':to': to,
      },
      ExpressionAttributeNames: {
        '#p1': statusAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: await batchHydrate(result.Items as UnhydratedNotice[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: NewNotice | Notice): Promise<void> => {
    //Explicitly generate an id if one isn't set
    const id = document.id || uuidv4();

    let userId: string | undefined;
    //Type guard to know if user is a string (their id) or a hydrated User type
    if (document.user && typeof document.user !== 'string' && document.user.id) {
      userId = document.user.id;
    } else if (document.user && typeof document.user === 'string') {
      userId = document.user;
    }

    await client.put({
      id: id,
      date: document.date,
      body: document.body,
      user: userId,
      status: getStatus(document),
      type: document.type,
      subject: document.subject,
    } as UnhydratedNotice);
  },
  batchPut: async (documents: UnhydratedNotice[]): Promise<void> => client.batchPut(documents),
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
};

module.exports = notice;
export default notice;
