import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';
import { v4 as uuidv4 } from 'uuid';

import Comment from '../../datatypes/Comment';
import { CubeImage } from '../../datatypes/Cube';
import User from '../../datatypes/User';
import { getImageData } from '../../util/imageutil';
import createClient from '../util';
import UserModel from './user';

enum FIELDS {
  ID = 'id',
  PARENT = 'parent',
  TYPE = 'type',
  OWNER = 'owner',
  BODY = 'body',
  DATE = 'date',
}

type CreateComment = {
  [FIELDS.ID]?: string;
  [FIELDS.BODY]: string;
  [FIELDS.OWNER]?: string | null;
  [FIELDS.DATE]: number;
  [FIELDS.PARENT]: string;
  [FIELDS.TYPE]: string;
};

const client = createClient({
  name: 'COMMENTS',
  partitionKey: FIELDS.ID,
  indexes: [
    {
      name: 'ByParent',
      partitionKey: FIELDS.PARENT,
      sortKey: FIELDS.DATE,
    },
    {
      name: 'ByOwner',
      partitionKey: FIELDS.OWNER,
      sortKey: FIELDS.DATE,
    },
  ],
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.PARENT]: 'S',
    [FIELDS.OWNER]: 'S',
  },
});

const createHydratedComment = (document: DocumentClient.AttributeMap, owner: User, image: CubeImage): Comment => {
  return {
    id: document.id,
    parent: document.parent,
    date: document.date,
    type: document.type,
    body: document.body,
    owner: owner,
    image: image,
  };
};

const getAnonymousUser = (): User => {
  return {
    id: '404',
    username: 'Anonymous',
  } as User;
};

const createHydratedCommentWithoutOwner = (item: DocumentClient.AttributeMap): Comment => {
  return createHydratedComment(item, getAnonymousUser(), getImageData('Ambush Viper'));
};

const hydrate = async (item?: DocumentClient.AttributeMap): Promise<Comment | undefined> => {
  if (!item) {
    return item;
  }

  if (!item.owner || item.owner === 'null') {
    return createHydratedCommentWithoutOwner(item);
  }

  const owner: User = await UserModel.getById(item.owner);
  return createHydratedComment(item, owner, getImageData(owner.imageName));
};

const batchHydrate = async (items: DocumentClient.ItemList | undefined): Promise<Comment[] | undefined> => {
  if (!items) {
    return [];
  }
  const owners = await UserModel.batchGet(items.filter((item) => item.owner).map((item) => item.owner));

  return items.map((item) => {
    if (!item.owner || item.owner === 'null') {
      return createHydratedCommentWithoutOwner(item);
    }

    let owner: User | undefined = owners.find((owner: User) => owner.id === item.owner);
    let image: CubeImage;

    if (!owner) {
      owner = getAnonymousUser();
      image = getImageData('Ambush Viper');
    } else {
      image = getImageData(owner.imageName);
    }

    return createHydratedComment(item, owner, image);
  });
};

const comment = {
  getById: async (id: string): Promise<Comment | undefined> => hydrate((await client.get(id)).Item),
  queryByParentAndType: async (
    parent: string,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: DocumentClient.ItemList; lastKey?: DocumentClient.Key }> => {
    const result = await client.query({
      IndexName: 'ByParent',
      KeyConditionExpression: `#p1 = :parent`,
      ExpressionAttributeValues: {
        ':parent': parent,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.PARENT,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: 10,
    });

    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  queryByOwner: async (
    owner: string,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: DocumentClient.ItemList; lastKey?: DocumentClient.Key }> => {
    const result = await client.query({
      IndexName: 'ByOwner',
      KeyConditionExpression: `#p1 = :owner`,
      ExpressionAttributeValues: {
        ':owner': owner,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.OWNER,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: CreateComment | Comment): Promise<DocumentClient.PutItemOutput> => {
    const id = document[FIELDS.ID] || uuidv4();

    //Type guard to know if owner is a string (their id) or a hydrated User type
    if (document.owner && typeof document.owner !== 'string' && document.owner.id) {
      document.owner = document.owner.id;
    }

    return client.put({
      [FIELDS.ID]: id,
      [FIELDS.DATE]: document.date,
      [FIELDS.BODY]: document.body,
      [FIELDS.OWNER]: document.owner,
      [FIELDS.PARENT]: document.parent,
      [FIELDS.TYPE]: document.type,
    });
  },
  batchPut: async (documents: DocumentClient.AttributeMap[]): Promise<void> => {
    // only used for migration
    await client.batchPut(documents);
  },
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
  scan: async (
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: DocumentClient.ItemList; lastKey?: DocumentClient.Key }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
    });
    return {
      items: result.Items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  FIELDS,
};

module.exports = comment;
export default comment;
