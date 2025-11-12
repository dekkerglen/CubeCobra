import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import BlogPost, { UnhydratedBlogPost } from '@utils/datatypes/BlogPost';
import { BoardChanges, BoardType, Changes } from '@utils/datatypes/Card';
import CubeType from '@utils/datatypes/Cube';
import UserType from '@utils/datatypes/User';
import createClient from 'dynamo/util';
import { cardFromId } from 'serverutils/carddb';
import { v4 as uuidv4 } from 'uuid';

import Changelog from './changelog';
import Cube from './cube';
import User from './user';

const client = createClient({
  name: 'BLOG',
  partitionKey: 'id',
  attributes: {
    cube: 'S',
    date: 'N',
    id: 'S',
    owner: 'S',
  },
  indexes: [
    {
      name: 'ByCube',
      partitionKey: 'cube',
      sortKey: 'date',
    },
    {
      name: 'ByOwner',
      partitionKey: 'owner',
      sortKey: 'date',
    },
  ],
});

const createHydratedBlog = (
  document: UnhydratedBlogPost,
  owner: UserType,
  cubeName: string,
  Changelog?: Partial<Changes>,
): BlogPost => {
  return {
    id: document.id!,
    body: document.body || '', //Body can be empty or null, such as an automated changelog post, but BlogPost wants a string
    date: document.date!,
    cube: document.cube,
    title: document.title,
    owner: owner,
    cubeName: cubeName,
    Changelog: Changelog,
  };
};

const hydrate = async (document?: UnhydratedBlogPost): Promise<BlogPost | undefined> => {
  if (!document) {
    return document;
  }

  let cubeName = 'Unknown';

  const owner = await User.getById(document.owner);

  if (document.cube && document.cube !== 'DEVBLOG') {
    const cube = await Cube.getById(document.cube);
    if (cube) {
      cubeName = cube.name;
    }
  }

  if (!document.changelist) {
    return createHydratedBlog(document, owner!, cubeName);
  }

  const changelog = await Changelog.getById(document.cube, document.changelist);

  return createHydratedBlog(document, owner!, cubeName, changelog);
};

const batchHydrate = async (documents: UnhydratedBlogPost[]): Promise<BlogPost[]> => {
  const keys = documents
    .filter((document) => document.changelist)
    .map((document) => ({ cube: document.cube, id: document.changelist }));
  const changelists = await Changelog.batchGet(keys);

  const owners: UserType[] = await User.batchGet(documents.map((document) => document.owner));
  const cubes: CubeType[] = await Cube.batchGet(documents.map((document) => document.cube));

  return documents.map((document) => {
    const owner = owners.find((owner) => owner.id === document.owner);
    let cubeName = 'Unknown';
    if (document.cube && document.cube !== 'DEVBLOG') {
      const cube = cubes.find((c) => c.id === document.cube);
      if (cube) {
        cubeName = cube.name;
      }
    }

    let Changelog;
    if (document.changelist) {
      const id = keys.findIndex((key) => key.id === document.changelist);
      Changelog = changelists[id];
    }

    return createHydratedBlog(document, owner!, cubeName, Changelog);
  });
};

const fillRequiredDetails = (document: UnhydratedBlogPost): UnhydratedBlogPost => {
  return {
    id: document.id || uuidv4(),
    cube: document.cube,
    date: document.date || Date.now().valueOf(),
    owner: document.owner,
    body: document.body ? document.body.substring(0, 10000) : undefined,
    title: document.title,
    changelist: document.changelist,
  };
};

const blog = {
  getById: async (id: string): Promise<BlogPost | undefined> =>
    hydrate((await client.get(id)).Item as UnhydratedBlogPost),
  getUnhydrated: async (id: string): Promise<UnhydratedBlogPost | undefined> =>
    (await client.get(id)).Item as UnhydratedBlogPost,
  getByCube: async (
    cube: string,
    limit: number,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items: BlogPost[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const cubeAttr: keyof UnhydratedBlogPost = 'cube';

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
      items: result.Items ? await batchHydrate(result.Items as UnhydratedBlogPost[]) : [],
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByOwner: async (
    owner: string,
    limit: number,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items: BlogPost[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    const ownerAttr: keyof UnhydratedBlogPost = 'owner';

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
      Limit: limit || 36,
    });
    return {
      items: result.Items ? await batchHydrate(result.Items as UnhydratedBlogPost[]) : [],
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: UnhydratedBlogPost): Promise<string> => {
    const filled = fillRequiredDetails(document);
    client.put(filled);

    return filled.id!;
  },
  delete: async (id: string): Promise<void> => {
    await client.delete({ id });
  },
  batchPut: async (documents: UnhydratedBlogPost[]): Promise<void> => {
    await client.batchPut(documents.map((document) => fillRequiredDetails(document)));
  },
  batchGet: async (ids: string[]): Promise<BlogPost[]> => batchHydrate(await client.batchGet(ids)),
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
  changelogToText: (changelog: Changes): string => {
    let result = '';

    for (const [board, name] of [
      ['mainboard', 'Mainboard'],
      ['sideboard', 'Sideboard'],
    ]) {
      if (!changelog[board as BoardType]) {
        continue;
      }

      const boardChanges = changelog[board as BoardType] as BoardChanges;

      result += `${name}:\n`;

      if (boardChanges.adds) {
        result += `Added:\n${boardChanges.adds.map((add) => cardFromId(add.cardID).name).join('\n')}\n`;
      }

      if (boardChanges.removes) {
        result += `Removed:\n${boardChanges.removes
          .map((remove) => cardFromId(remove.oldCard.cardID).name)
          .join('\n')}\n`;
      }

      if (boardChanges.swaps) {
        result += `Swapped:\n${boardChanges.swaps
          .map((swap) => `${cardFromId(swap.oldCard.cardID).name} -> ${cardFromId(swap.card.cardID).name}`)
          .join('\n')}\n`;
      }

      if (boardChanges.edits) {
        result += `Edited:\n${boardChanges.edits
          .map((edit) => `${cardFromId(edit.oldCard.cardID).name}`)
          .join('\n')}\n`;
      }
    }

    return result;
  },
};
module.exports = blog;
export default blog;
