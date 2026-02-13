// Migrated to /dao/ChangelogDynamoDao.ts

import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { BoardChanges, Changes } from '@utils/datatypes/Card';
import ChangelogType, { CubeChangeLog } from '@utils/datatypes/ChangeLog';
import createClient from 'dynamo/util';
import { cardFromId } from 'serverutils/carddb';
import { v4 as uuidv4 } from 'uuid';

import { getBucketName, getObject, putObject } from '../s3client';

const CARD_LIMIT = 10000;

const client = createClient({
  name: 'CUBE_CHANGELOG',
  partitionKey: 'cube',
  sortKey: 'date',
  attributes: {
    cube: 'S',
    date: 'N',
  },
});

const sanitizeChangelog = (changelog: Changes): Changes => {
  for (const [key, value] of Object.entries(changelog)) {
    if (key === 'version') continue;
    const boardChanges = value as BoardChanges;
    if (boardChanges.adds) {
      for (let i = 0; i < boardChanges.adds.length; i++) {
        delete boardChanges.adds[i]!.details;
      }
    }
    if (boardChanges.removes) {
      for (let i = 0; i < boardChanges.removes.length; i++) {
        delete boardChanges.removes[i]!.oldCard.details;
      }
    }
    if (boardChanges.swaps) {
      for (let i = 0; i < boardChanges.swaps.length; i++) {
        delete boardChanges.swaps[i]!.oldCard.details;
        delete boardChanges.swaps[i]!.card.details;
      }
    }
    if (boardChanges.edits) {
      for (let i = 0; i < boardChanges.edits.length; i++) {
        delete boardChanges.edits[i]!.oldCard.details;
        delete boardChanges.edits[i]!.newCard.details;
      }
    }
  }
  return changelog;
};

const hydrateChangelog = (changelog: Changes): Changes => {
  let totalCards = 0;

  for (const [key, value] of Object.entries(changelog)) {
    if (key === 'version') continue;
    const boardChanges = value as BoardChanges;
    if (boardChanges.adds) {
      totalCards += boardChanges.adds.length;
    }
    if (boardChanges.removes) {
      totalCards += boardChanges.removes.length;
    }
    if (boardChanges.swaps) {
      totalCards += boardChanges.swaps.length;
    }
    if (boardChanges.edits) {
      totalCards += boardChanges.edits.length;
    }
  }

  if (totalCards > CARD_LIMIT) {
    throw new Error('Too many cards to load this changelog');
  }

  for (const [key, value] of Object.entries(changelog)) {
    if (key === 'version') continue;
    const boardChanges = value as BoardChanges;
    if (boardChanges.adds) {
      for (let i = 0; i < boardChanges.adds.length; i++) {
        boardChanges.adds[i]!.details = {
          ...cardFromId(boardChanges.adds[i]!.cardID),
        };
      }
    }
    if (boardChanges.removes) {
      for (let i = 0; i < boardChanges.removes.length; i++) {
        boardChanges.removes[i]!.oldCard.details = {
          ...cardFromId(boardChanges.removes[i]!.oldCard.cardID),
        };
      }
    }
    if (boardChanges.swaps) {
      for (let i = 0; i < boardChanges.swaps.length; i++) {
        boardChanges.swaps[i]!.oldCard.details = {
          ...cardFromId(boardChanges.swaps[i]!.oldCard.cardID),
        };
        boardChanges.swaps[i]!.card.details = {
          ...cardFromId(boardChanges.swaps[i]!.card.cardID),
        };
      }
    }
    if (boardChanges.edits) {
      for (let i = 0; i < boardChanges.edits.length; i++) {
        boardChanges.edits[i]!.oldCard.details = {
          ...cardFromId(boardChanges.edits[i]!.oldCard.cardID),
        };
        boardChanges.edits[i]!.newCard.details = {
          ...cardFromId(boardChanges.edits[i]!.newCard.cardID),
        };
      }
    }
  }
  return changelog;
};

const getChangelog = async (cubeId: string, id: string): Promise<Changes> => {
  const changelog = await getObject(getBucketName(), `changelog/${cubeId}/${id}.json`);

  try {
    return hydrateChangelog(changelog);
  } catch {
    return changelog;
  }
};

const Changelog = {
  getById: getChangelog,
  getByCube: async (
    cubeId: string,
    limit: number,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items?: CubeChangeLog[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    const cubeAttr: keyof ChangelogType = 'cube';

    const result = await client.query({
      KeyConditionExpression: `#p1 = :cube`,
      ExpressionAttributeValues: {
        ':cube': cubeId,
      },
      ExpressionAttributeNames: {
        '#p1': cubeAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
      Limit: limit || 36,
    });

    const items: CubeChangeLog[] = await Promise.all(
      ((result.Items as ChangelogType[]) || []).map(async (item) => ({
        cubeId,
        date: item.date,
        changelog: await getChangelog(cubeId, item.id),
      })),
    );

    return {
      items,
      lastKey: result.LastEvaluatedKey,
    };
  },
  put: async (changelog: Changes, cube: string): Promise<string> => {
    const id = uuidv4();
    await putObject(getBucketName(), `changelog/${cube}/${id}.json`, sanitizeChangelog(changelog));
    await client.put({
      id,
      cube,
      date: new Date().valueOf(),
    } as ChangelogType);
    return id;
  },
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
  scan: async (
    limit: number,
    lastKey?: Record<string, NativeAttributeValue>,
  ): Promise<{ items: ChangelogType[]; lastKey?: Record<string, NativeAttributeValue> }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
      Limit: limit || 36,
    });

    return {
      items: (result.Items as ChangelogType[]) || [],
      lastKey: result.LastEvaluatedKey,
    };
  },
  batchGet: async (keys: Record<string, NativeAttributeValue>[]): Promise<Changes[]> => {
    const result = await Promise.all(
      keys.map(async (key) => {
        const data = await getObject(getBucketName(), `changelog/${key.cube}/${key.id}.json`);
        try {
          const hydrated = hydrateChangelog(data);
          return hydrated;
        } catch {
          return data;
        }
      }),
    );

    return result;
  },
};

module.exports = Changelog;

export default Changelog;
