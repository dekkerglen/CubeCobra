import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';
import { v4 as uuidv4 } from 'uuid';

import Comment, { UnhydratedComment } from '../../datatypes/Comment';
import { CubeImage } from '../../datatypes/Cube';
import User from '../../datatypes/User';
import { getImageData } from '../../util/imageutil';
import createClient from '../util';
import UserModel from './user';

const client = createClient({
  name: 'COMMENTS',
  partitionKey: 'id',
  indexes: [
    {
      name: 'ByParent',
      partitionKey: 'parent',
      sortKey: 'date',
    },
    {
      name: 'ByOwner',
      partitionKey: 'owner',
      sortKey: 'date',
    },
  ],
  attributes: {
    id: 'S',
    date: 'N',
    parent: 'S',
    owner: 'S',
  },
});

const createHydratedComment = (document: UnhydratedComment, owner: User, image: CubeImage): Comment => {
  return {
    id: document.id!,
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

const createHydratedCommentWithoutOwner = (item: UnhydratedComment): Comment => {
  return createHydratedComment(item, getAnonymousUser(), getImageData('Ambush Viper'));
};

const hydrate = async (item?: UnhydratedComment): Promise<Comment | undefined> => {
  if (!item) {
    return item;
  }

  if (!item.owner || item.owner === 'null') {
    return createHydratedCommentWithoutOwner(item);
  }

  const owner: User = await UserModel.getById(item.owner);
  return createHydratedComment(item, owner, getImageData(owner.imageName));
};

const batchHydrate = async (items?: UnhydratedComment[]): Promise<Comment[] | undefined> => {
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
  getById: async (id: string): Promise<Comment | undefined> =>
    hydrate((await client.get(id)).Item as UnhydratedComment),
  queryByParentAndType: async (
    parent: string,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: Comment[]; lastKey?: DocumentClient.Key }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const parentAttr: keyof UnhydratedComment = 'parent';

    const result = await client.query({
      IndexName: 'ByParent',
      KeyConditionExpression: `#p1 = :parent`,
      ExpressionAttributeValues: {
        ':parent': parent,
      },
      ExpressionAttributeNames: {
        '#p1': parentAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: 10,
    });

    return {
      items: await batchHydrate(result.Items as UnhydratedComment[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  queryByOwner: async (
    owner: string,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: Comment[]; lastKey?: DocumentClient.Key }> => {
    const ownerAttr: keyof UnhydratedComment = 'owner';

    const result = await client.query({
      IndexName: 'ByOwner',
      KeyConditionExpression: `#p1 = :owner`,
      ExpressionAttributeValues: {
        ':owner': owner,
      },
      ExpressionAttributeNames: {
        '#p1': ownerAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    return {
      items: await batchHydrate(result.Items as UnhydratedComment[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: UnhydratedComment | Comment): Promise<DocumentClient.PutItemOutput> => {
    const id = document.id || uuidv4();

    let ownerId: string | undefined;
    //Type guard to know if owner is a string (their id) or a hydrated User type
    if (document.owner && typeof document.owner !== 'string' && document.owner.id) {
      ownerId = document.owner.id;
    } else if (document.owner && typeof document.owner === 'string') {
      ownerId = document.owner;
    }

    return client.put({
      id: id,
      date: document.date,
      body: document.body,
      owner: ownerId,
      parent: document.parent,
      type: document.type,
    } as UnhydratedComment);
  },
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
  scan: async (
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: UnhydratedComment[]; lastKey?: DocumentClient.Key }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
    });
    return {
      items: result.Items as UnhydratedComment[],
      lastKey: result.LastEvaluatedKey,
    };
  },
};

module.exports = comment;
export default comment;
