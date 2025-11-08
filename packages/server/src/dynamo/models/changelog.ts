import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

import { Changes } from '@utils/datatypes/Card';
import ChangelogType, { CubeChangeLog } from '@utils/datatypes/ChangeLog';
import { cardFromId } from '../../util/carddb';
import { getBucketName, getObject, putObject } from '../s3client';
import createClient from '../util';

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
  for (const [, value] of Object.entries(changelog)) {
    if (value.adds) {
      for (let i = 0; i < value.adds.length; i++) {
        delete value.adds[i].details;
      }
    }
    if (value.removes) {
      for (let i = 0; i < value.removes.length; i++) {
        delete value.removes[i].oldCard.details;
      }
    }
    if (value.swaps) {
      for (let i = 0; i < value.swaps.length; i++) {
        delete value.swaps[i].oldCard.details;
        delete value.swaps[i].card.details;
      }
    }
    if (value.edits) {
      for (let i = 0; i < value.edits.length; i++) {
        delete value.edits[i].oldCard.details;
        delete value.edits[i].newCard.details;
      }
    }
  }
  return changelog;
};

const hydrateChangelog = (changelog: Changes): Changes => {
  let totalCards = 0;

  for (const [, value] of Object.entries(changelog)) {
    if (value.adds) {
      totalCards += value.adds.length;
    }
    if (value.removes) {
      totalCards += value.removes.length;
    }
    if (value.swaps) {
      totalCards += value.swaps.length;
    }
    if (value.edits) {
      totalCards += value.edits.length;
    }
  }

  if (totalCards > CARD_LIMIT) {
    throw new Error('Too many cards to load this changelog');
  }

  for (const [, value] of Object.entries(changelog)) {
    if (value.adds) {
      for (let i = 0; i < value.adds.length; i++) {
        value.adds[i].details = {
          ...cardFromId(value.adds[i].cardID),
        };
      }
    }
    if (value.removes) {
      for (let i = 0; i < value.removes.length; i++) {
        value.removes[i].oldCard.details = {
          ...cardFromId(value.removes[i].oldCard.cardID),
        };
      }
    }
    if (value.swaps) {
      for (let i = 0; i < value.swaps.length; i++) {
        value.swaps[i].oldCard.details = {
          ...cardFromId(value.swaps[i].oldCard.cardID),
        };
        value.swaps[i].card.details = {
          ...cardFromId(value.swaps[i].card.cardID),
        };
      }
    }
    if (value.edits) {
      for (let i = 0; i < value.edits.length; i++) {
        value.edits[i].oldCard.details = {
          ...cardFromId(value.edits[i].oldCard.cardID),
        };
        value.edits[i].newCard.details = {
          ...cardFromId(value.edits[i].newCard.cardID),
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
