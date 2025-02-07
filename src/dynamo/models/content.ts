import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';
import { v4 as uuidv4 } from 'uuid';

const User = require('./user');
const { getImageData } = require('../../util/imageutil');

import Article from '../../datatypes/Article';
import { Content, ContentType, UnhydratedContent } from '../../datatypes/Content';
import Episode from '../../datatypes/Episode';
import Image from '../../datatypes/Image';
import Podcast from '../../datatypes/Podcast';
import UserType from '../../datatypes/User';
import Video from '../../datatypes/Video';
import { getBucketName, getObject, putObject } from '../s3client';
import createClient from '../util';

const FIELDS = {
  ID: 'id',
  DATE: 'date',
  STATUS: 'status',
  OWNER: 'owner',
  TYPE: 'type',
  TYPE_STATUS_COMP: 'typeStatusComp',
  TYPE_OWNER_COMP: 'typeOwnerComp',
  // optional FIELDS
  TITLE: 'title',
  BODY: 'body',
  SHORT: 'short',
  URL: 'url',
  IMAGE_LINK: 'image',
  IMAGE_NAME: 'imageName',
  USERNAME: 'username',
  PODCAST_NAME: 'podcastName',
  PODCAST_ID: 'podcast',
  PODCAST_GUID: 'podcastGuid',
  PODCAST_LINK: 'podcastLink',
};

const createHydratedContent = (document: UnhydratedContent, owner: UserType, image: Image): Content => {
  //Because type is a known set we don't need a default/unknown type case
  switch (document.type as ContentType) {
    case ContentType.ARTICLE:
      return {
        ...document,
        owner: owner,
        image: image,
      } as Article;
    case ContentType.EPISODE:
      return {
        ...document,
        owner: owner,
      } as Episode;
    case ContentType.PODCAST:
      return {
        ...document,
        owner: owner,
      } as Podcast;
    case ContentType.VIDEO:
      return {
        ...document,
        owner: owner,
        image: image,
      } as Video;
  }
};

const hydrate = async (content: UnhydratedContent): Promise<Content> => {
  if (!content) {
    return content;
  }

  const owner: UserType = content.owner ? await User.getById(content.owner) : undefined;
  const image: Image = content.imageName ? getImageData(content.imageName) : undefined;

  return createHydratedContent(content, owner, image);
};

const batchHydrate = async (contents: UnhydratedContent[]): Promise<Content[]> => {
  const owners: UserType[] = await User.batchGet(contents.map((content) => content.owner));

  return contents.map((content) => {
    const owner = owners.find((owner) => owner.id === content.owner);

    const image: Image = content.imageName ? getImageData(content.imageName) : undefined;

    //We should always find the owner
    return createHydratedContent(content, owner!, image);
  });
};

const client = createClient({
  name: 'CONTENT',
  partitionKey: FIELDS.ID,
  attributes: {
    id: 'S',
    date: 'N',
    status: 'S',
    typeStatusComp: 'S',
    typeOwnerComp: 'S',
  },
  indexes: [
    {
      partitionKey: 'status',
      sortKey: 'date',
      name: 'ByStatus',
    },
    {
      partitionKey: 'typeOwnerComp',
      sortKey: 'date',
      name: 'ByTypeOwnerComp',
    },
    {
      partitionKey: 'typeStatusComp',
      sortKey: 'date',
      name: 'ByTypeStatusComp',
    },
  ],
});

const addBody = async (content: UnhydratedContent): Promise<UnhydratedContent> => {
  try {
    const document = await getObject(getBucketName(), `content/${content.id}.json`);

    return {
      ...content,
      body: document,
    };
  } catch {
    return content;
  }
};

const putBody = async (content: Article | Episode | Podcast | Video) => {
  if (content.body) {
    await putBodyRaw(content.id, content.body);
  }
};

const putBodyRaw = async (id: string, body?: string) => {
  if (body && body.length > 0) {
    await putObject(getBucketName(), `content/${id}.json`, body);
  }
};

//TODO: Getters for each variant
const content = {
  getById: async (id: string): Promise<Content> =>
    hydrate(await addBody((await client.get(id)).Item as UnhydratedContent)),
  getByStatus: async (
    status: string,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: Content[]; lastKey?: DocumentClient.Key }> => {
    //Using keyof .. provides static checking that the attribute exists in the type. Also its own const b/c inline "as keyof" not validating
    const statusAttr: keyof UnhydratedContent = 'status';

    const result = await client.query({
      IndexName: 'ByStatus',
      KeyConditionExpression: `#p1 = :status`,
      ExpressionAttributeValues: {
        ':status': status,
      },
      ExpressionAttributeNames: {
        '#p1': statusAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: await batchHydrate(result.Items as UnhydratedContent[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByTypeAndStatus: async (
    type: ContentType,
    status: string,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: Content[]; lastKey?: DocumentClient.Key }> => {
    const typeStatusCompAttr: keyof UnhydratedContent = 'typeStatusComp';

    const result = await client.query({
      IndexName: 'ByTypeStatusComp',
      KeyConditionExpression: `#p1 = :stcomp`,
      ExpressionAttributeValues: {
        ':stcomp': `${type}:${status}`,
      },
      ExpressionAttributeNames: {
        '#p1': typeStatusCompAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: await batchHydrate(result.Items as UnhydratedContent[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByTypeAndOwner: async (
    type: ContentType,
    owner: string,
    lastKey?: DocumentClient.Key,
  ): Promise<{ items?: Content[]; lastKey?: DocumentClient.Key }> => {
    const typeOwnerCompAttr: keyof UnhydratedContent = 'typeOwnerComp';

    const result = await client.query({
      IndexName: 'ByTypeOwnerComp',
      KeyConditionExpression: `#p1 = :tocomp`,
      ExpressionAttributeValues: {
        ':tocomp': `${type}:${owner}`,
      },
      ExpressionAttributeNames: {
        '#p1': typeOwnerCompAttr,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: await batchHydrate(result.Items as UnhydratedContent[]),
      lastKey: result.LastEvaluatedKey,
    };
  },
  update: async (document: Content): Promise<DocumentClient.PutItemOutput> => {
    if (!document.id) {
      throw new Error('Invalid document: No partition key provided');
    }

    //If the owner is a User object, get its Id without modifying the incoming document
    let ownerId;
    if (document.owner.id) {
      ownerId = document.owner.id;
    } else {
      ownerId = document.owner;
    }

    document.typeStatusComp = `${document.type}:${document.status}`;
    document.typeOwnerComp = `${document.type}:${ownerId}`;

    await putBody(document);
    delete document.body;
    return client.put({
      ...document,
      owner: ownerId,
    });
  },
  put: async (document: Article | Episode | Podcast | Video, type: ContentType) => {
    document.id = document.id || uuidv4();

    if (document.body) {
      await putBody(document);
      delete document.body;
    }

    // if document.image is an object
    if (document.image && typeof document.image === 'object') {
      delete document.image;
    }

    let ownerId: string | undefined;
    //Type guard to know if owner is a string (their id) or a hydrated User type
    if (document.owner && typeof document.owner !== 'string' && document.owner.id) {
      ownerId = document.owner.id;
    } else if (document.owner && typeof document.owner === 'string') {
      ownerId = document.owner;
    }

    return client.put({
      ...document,
      type,
      typeOwnerComp: `${type}:${ownerId}`,
      typeStatusComp: `${type}:${document.status}`,
      owner: ownerId,
    });
  },
  batchPut: async (documents: (Article | Episode | Podcast | Video)[]) => {
    const docs = documents.map((document) => {
      let ownerId;
      if (document.owner && document.owner.id) {
        ownerId = document.owner.id;
      } else {
        ownerId = document.owner;
      }

      return {
        ...document,
        owner: ownerId,
      };
    });

    await Promise.all(
      docs.map(async (document) => {
        await putBodyRaw(document.id, document.body);
        delete document.body;
      }),
    );
    client.batchPut(docs);
  },
  batchDelete: async (keys: DocumentClient.Key[]): Promise<void> => {
    return client.batchDelete(keys);
  },
  scan: async (lastKey: DocumentClient.Key): Promise<{ items?: UnhydratedContent[]; lastKey?: DocumentClient.Key }> => {
    const result = await client.scan({
      ExclusiveStartKey: lastKey,
    });
    return {
      items: result.Items as UnhydratedContent[],
      lastKey: result.LastEvaluatedKey,
    };
  },
  createTable: async (): Promise<DocumentClient.CreateTableOutput> => client.createTable(),
};

module.exports = content;
export default content;
