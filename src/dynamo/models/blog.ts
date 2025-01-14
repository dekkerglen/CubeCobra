// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

//import Converter from 'aws-sdk2/aws/dynamodb/Converter';
import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';
import { v4 as uuidv4 } from 'uuid';

import { cardFromId } from '../../util/carddb';
import createClient from '../util';
const Changelog = require('./changelog');
import BlogPost from '../../datatypes/BlogPost';
import { BoardChanges, Changes } from '../../datatypes/Card';
import CubeType from '../../datatypes/Cube';
import UserType from '../../datatypes/User';
import Cube from './cube';
import User from './user';

enum FIELDS {
  ID = 'id',
  BODY = 'body',
  OWNER = 'owner',
  DATE = 'date',
  CUBE_ID = 'cube',
  TITLE = 'title',
  CHANGELIST_ID = 'changelist',
}

type CreateBlogPost = {
  [FIELDS.ID]?: string;
  [FIELDS.BODY]?: string;
  [FIELDS.OWNER]: string;
  [FIELDS.DATE]?: number;
  [FIELDS.CUBE_ID]: string;
  [FIELDS.TITLE]: string;
  [FIELDS.CHANGELIST_ID]?: string;
};

const client = createClient({
  name: 'BLOG',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.CUBE_ID]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.ID]: 'S',
    [FIELDS.OWNER]: 'S',
  },
  indexes: [
    {
      name: 'ByCube',
      partitionKey: FIELDS.CUBE_ID,
      sortKey: FIELDS.DATE,
    },
    {
      name: 'ByOwner',
      partitionKey: FIELDS.OWNER,
      sortKey: FIELDS.DATE,
    },
  ],
});

const createHydratedBlog = (
  document: DocumentClient.AttributeMap,
  owner: any,
  cubeName: string,
  Changelog?: Partial<Changes>,
): BlogPost => {
  return {
    id: document.id,
    body: document.body,
    date: document.date,
    cube: document.cube,
    title: document.title,
    owner: owner,
    cubeName: cubeName,
    Changelog: Changelog,
  };
};

const hydrate = async (document?: DocumentClient.AttributeMap): Promise<BlogPost | undefined> => {
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
    return createHydratedBlog(document, owner, cubeName);
  }

  const changelog = await Changelog.getById(document.cube, document.changelist);

  return createHydratedBlog(document, owner, cubeName, changelog);
};

const batchHydrate = async (documents?: DocumentClient.ItemList): Promise<BlogPost[] | undefined> => {
  if (!documents) {
    return undefined;
  }

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

    return createHydratedBlog(document, owner, cubeName, Changelog);
  });
};

function isBoardChanges(boardChanges: any): boardChanges is BoardChanges {
  return (
    Array.isArray(boardChanges.adds) &&
    Array.isArray(boardChanges.removes) &&
    Array.isArray(boardChanges.swaps) &&
    Array.isArray(boardChanges.edits)
  );
}

module.exports = {
  getById: async (id: string): Promise<BlogPost | undefined> => hydrate((await client.get(id)).Item),
  getUnhydrated: async (id: string): Promise<DocumentClient.AttributeMap | undefined> => (await client.get(id)).Item,
  getByCube: async (cube: string, limit: number, lastKey?: DocumentClient.Key) => {
    const result = await client.query({
      IndexName: 'ByCube',
      KeyConditionExpression: `#p1 = :cube`,
      ExpressionAttributeValues: {
        ':cube': cube,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.CUBE_ID,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: limit || 36,
    });
    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByOwner: async (
    owner: string,
    limit: number,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: BlogPost[]; lastKey?: DocumentClient.Key }> => {
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
      Limit: limit || 36,
    });
    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (document: CreateBlogPost): Promise<string> => {
    const id = document[FIELDS.ID] || uuidv4();
    client.put({
      [FIELDS.ID]: id,
      [FIELDS.CUBE_ID]: document[FIELDS.CUBE_ID],
      [FIELDS.DATE]: document[FIELDS.DATE] || Date.now().valueOf(),
      [FIELDS.OWNER]: document[FIELDS.OWNER],
      [FIELDS.BODY]: document[FIELDS.BODY] ? document[FIELDS.BODY].substring(0, 10000) : null,
      [FIELDS.TITLE]: document[FIELDS.TITLE],
      [FIELDS.CHANGELIST_ID]: document[FIELDS.CHANGELIST_ID],
    });

    return id;
  },
  delete: async (id: DocumentClient.Key): Promise<void> => {
    await client.delete({ id });
  },
  batchPut: async (documents: CreateBlogPost[]): Promise<void> => {
    await client.batchPut(
      documents.map((document) => ({
        [FIELDS.ID]: document[FIELDS.ID],
        [FIELDS.CUBE_ID]: document[FIELDS.CUBE_ID],
        [FIELDS.DATE]: document[FIELDS.DATE] || Date.now().valueOf(),
        [FIELDS.OWNER]: document[FIELDS.OWNER],
        [FIELDS.BODY]: document[FIELDS.BODY] ? document[FIELDS.BODY].substring(0, 10000) : null,
        [FIELDS.TITLE]: document[FIELDS.TITLE],
        [FIELDS.CHANGELIST_ID]: document[FIELDS.CHANGELIST_ID],
      })),
    );
  },
  batchGet: async (ids: string[]): Promise<BlogPost[] | undefined> => batchHydrate(await client.batchGet(ids)),
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
  changelogToText: (changelog: any): string => {
    let result = '';

    for (const [board, name] of [
      ['mainboard', 'Mainboard'],
      ['sideboard', 'Sideboard'],
    ]) {
      if (!isBoardChanges(changelog[board])) {
        continue;
      }

      const boardChanges = changelog[board] as BoardChanges;

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
  FIELDS,
};
