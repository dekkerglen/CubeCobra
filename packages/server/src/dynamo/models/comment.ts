// Migrated to dao/CommentDynamoDao.ts

import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue, PutCommandOutput } from '@aws-sdk/lib-dynamodb';
import Comment, { UnhydratedComment } from '@utils/datatypes/Comment';
import { CubeImage } from '@utils/datatypes/Cube';
import User from '@utils/datatypes/User';
import createClient from 'dynamo/util';
import { getImageData } from 'serverutils/imageutil';
import { v4 as uuidv4 } from 'uuid';

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
    dateCreated: document.dateCreated,
    dateLastUpdated: document.dateLastUpdated,
  };
};

export const getAnonymousUser = (): User => {
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

  // TODO: Is this the best way to determine the comment has been deleted though?
  if (item.owner === '404') {
    return createHydratedCommentWithoutOwner(item);
  }

  const owner = await UserModel.getById(item.owner);
  if (!owner) {
    return createHydratedCommentWithoutOwner(item);
  }
  return createHydratedComment(item, owner, getImageData(owner.imageName));
};

const batchHydrate = async (items?: UnhydratedComment[]): Promise<Comment[] | undefined> => {
  if (!items) {
    return [];
  }
  const ownerIds = items.filter((item) => item.owner !== undefined).map((item) => item.owner) as string[];
  const owners = await UserModel.batchGet(ownerIds);

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
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: Comment[]; lastKey?: Record<string, NativeAttributeValue> }> => {
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
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: Comment[]; lastKey?: Record<string, NativeAttributeValue> }> => {
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
  put: async (document: UnhydratedComment | Comment): Promise<PutCommandOutput> => {
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
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
  scan: async (
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: UnhydratedComment[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
    });
    return {
      items: result.Items as UnhydratedComment[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  delete: async (key: { id: string }): Promise<void> => {
    await client.delete(key);
  },
};

module.exports = comment;
export default comment;
