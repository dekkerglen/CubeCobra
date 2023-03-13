const sanitizeHtml = require('sanitize-html');
const htmlToText = require('html-to-text');
const { getImageData } = require('../../serverjs/util');
const createClient = require('../util');
const { getObject, putObject } = require('../s3client');
const User = require('./user');

const removeSpan = (text) =>
  sanitizeHtml(text, {
    allowedTags: sanitizeHtml.defaults.allowedTags.filter((tag) => tag !== 'span'),
  });

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

const CONVERT_STATUS = {
  inReview: 'r',
  draft: 'd',
  published: 'p',
};

const STATUS = {
  IN_REVIEW: 'r',
  DRAFT: 'd',
  PUBLISHED: 'p',
};

const TYPES = {
  VIDEO: 'v',
  ARTICLE: 'a',
  EPISODE: 'e',
  PODCAST: 'p',
};

const hydrate = async (content) => {
  content.owner = await User.getById(content.owner);
  content.image = getImageData(content.imageName);

  return content;
};

const batchHydrate = async (contents) => {
  const owners = await User.batchGet(contents.map((content) => content.owner));

  return contents.map((content) => {
    content.owner = owners.find((owner) => owner.id === content.owner);
    content.image = getImageData(content.imageName);

    return content;
  });
};

const client = createClient({
  name: 'CONTENT',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.ID]: 'S',
    [FIELDS.DATE]: 'N',
    [FIELDS.STATUS]: 'S',
    [FIELDS.TYPE_STATUS_COMP]: 'S',
    [FIELDS.TYPE_OWNER_COMP]: 'S',
  },
  indexes: [
    {
      partitionKey: FIELDS.STATUS,
      sortKey: FIELDS.DATE,
      name: 'ByStatus',
    },
    {
      partitionKey: FIELDS.TYPE_OWNER_COMP,
      sortKey: FIELDS.DATE,
      name: 'ByTypeOwnerComp',
    },
    {
      partitionKey: FIELDS.TYPE_STATUS_COMP,
      sortKey: FIELDS.DATE,
      name: 'ByTypeStatusComp',
    },
  ],
  FIELDS,
});

const addBody = async (content) => {
  try {
    const document = await getObject(process.env.DATA_BUCKET, `content/${content.id}.json`);

    return document;
  } catch (e) {
    return content;
  }
};

const putBody = async (content) => {
  if (content.body && content.body.length > 0) {
    await putObject(process.env.DATA_BUCKET, `content/${content.id}.json`, content.body);
  }
};

module.exports = {
  getById: async (id) => hydrate(await addBody((await client.get(id)).Item)),
  getByStatus: async (status, lastKey) => {
    const result = await client.query({
      IndexName: 'ByStatus',
      KeyConditionExpression: `#p1 = :status`,
      ExpressionAttributeValues: {
        ':status': status,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.STATUS,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByTypeAndStatus: async (type, status, lastKey) => {
    const result = await client.query({
      IndexName: 'ByTypeStatusComp',
      KeyConditionExpression: `#p1 = :stcomp`,
      ExpressionAttributeValues: {
        ':stcomp': `${type}:${status}`,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.TYPE_STATUS_COMP,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  getByTypeAndOwner: async (type, owner, lastKey) => {
    const result = await client.query({
      IndexName: 'ByTypeOwnerComp',
      KeyConditionExpression: `#p1 = :tocomp`,
      ExpressionAttributeValues: {
        ':tocomp': `${type}:${owner}`,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.TYPE_OWNER_COMP,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });
    return {
      items: await batchHydrate(result.Items),
      lastKey: result.LastEvaluatedKey,
    };
  },
  update: async (document) => {
    if (!document[FIELDS.ID]) {
      throw new Error('Invalid document: No partition key provided');
    }

    delete document.image;

    document[FIELDS.TYPE_STATUS_COMP] = `${document.type}:${document.status}`;
    document[FIELDS.TYPE_OWNER_COMP] = `${document.type}:${document.owner}`;

    if (document.owner.id) {
      document.owner = document.owner.id;
    }

    await putBody(document);
    delete document.body;
    return client.put(document);
  },
  put: async (document, type) => {
    await putBody(document);

    delete document.image;
    delete document.body;

    if (document.owner.id) {
      document.owner = document.owner.id;
    }

    client.put({
      [FIELDS.TYPE]: type,
      [FIELDS.TYPE_OWNER_COMP]: `${type}:${document.owner}`,
      [FIELDS.TYPE_STATUS_COMP]: `${type}:${document.status}`,
      ...document,
    });
  },
  batchPut: async (documents) => {
    await Promise.all(
      documents.map(async (document) => {
        if (document.owner.id) {
          document.owner = document.owner.id;
        }

        await putBody(document);
        delete document.body;
      }),
    );
    client.batchPut(documents);
  },
  createTable: async () => client.createTable(),
  convertVideo: (video) => ({
    [FIELDS.ID]: `${video._id}`,
    [FIELDS.DATE]: video.date.valueOf(),
    [FIELDS.STATUS]: CONVERT_STATUS[video.status],
    [FIELDS.OWNER]: `${video.owner}`,
    [FIELDS.TYPE]: TYPES.VIDEO,
    [FIELDS.TITLE]: video.title,
    [FIELDS.BODY]: video.body,
    [FIELDS.SHORT]: video.short,
    [FIELDS.URL]: video.url,
    [FIELDS.IMAGE_NAME]: video.imagename,
    [FIELDS.USERNAME]: video.username,
    [FIELDS.TYPE_STATUS_COMP]: `${TYPES.VIDEO}:${CONVERT_STATUS[video.status]}`,
    [FIELDS.TYPE_OWNER_COMP]: `${TYPES.VIDEO}:${video.owner}`,
  }),
  convertArticle: (article) => ({
    [FIELDS.ID]: `${article._id}`,
    [FIELDS.DATE]: article.date.valueOf(),
    [FIELDS.STATUS]: CONVERT_STATUS[article.status],
    [FIELDS.OWNER]: `${article.owner}`,
    [FIELDS.TYPE]: TYPES.ARTICLE,
    [FIELDS.TITLE]: article.title,
    [FIELDS.BODY]: article.body,
    [FIELDS.SHORT]: article.short,
    [FIELDS.IMAGE_NAME]: article.imagename,
    [FIELDS.USERNAME]: article.username,
    [FIELDS.TYPE_STATUS_COMP]: `${TYPES.ARTICLE}:${CONVERT_STATUS[article.status]}`,
    [FIELDS.TYPE_OWNER_COMP]: `${TYPES.ARTICLE}:${article.owner}`,
  }),
  convertEpisode: (episode) => ({
    [FIELDS.ID]: `${episode._id}`,
    [FIELDS.DATE]: episode.date.valueOf(),
    [FIELDS.STATUS]: STATUS.PUBLISHED,
    [FIELDS.OWNER]: `${episode.owner}`,
    [FIELDS.TYPE]: TYPES.EPISODE,
    [FIELDS.TITLE]: episode.title,
    [FIELDS.PODCAST_NAME]: episode.podcastname,
    [FIELDS.BODY]: removeSpan(episode.description),
    [FIELDS.PODCAST_ID]: `${episode.podcast}`,
    [FIELDS.URL]: episode.source,
    [FIELDS.IMAGE_LINK]: episode.image,
    [FIELDS.PODCAST_GUID]: episode.guid,
    [FIELDS.PODCAST_LINK]: episode.link,
    [FIELDS.USERNAME]: episode.username,
    [FIELDS.TYPE_STATUS_COMP]: `${TYPES.EPISODE}:${STATUS.PUBLISHED}`,
    [FIELDS.TYPE_OWNER_COMP]: `${TYPES.EPISODE}:${episode.owner}`,
    [FIELDS.SHORT]: htmlToText
      .fromString(removeSpan(episode.description), {
        wordwrap: 130,
      })
      .substring(0, 200),
  }),
  convertPodcast: (podcast) => ({
    [FIELDS.ID]: `${podcast._id}`,
    [FIELDS.DATE]: podcast.date.valueOf(),
    [FIELDS.STATUS]: CONVERT_STATUS[podcast.status],
    [FIELDS.OWNER]: `${podcast.owner}`,
    [FIELDS.TYPE]: TYPES.PODCAST,
    [FIELDS.TITLE]: podcast.title,
    [FIELDS.BODY]: removeSpan(podcast.description),
    [FIELDS.PODCAST_LINK]: podcast.url,
    [FIELDS.URL]: podcast.rss,
    [FIELDS.IMAGE_LINK]: podcast.image,
    [FIELDS.USERNAME]: podcast.username,
    [FIELDS.TYPE_STATUS_COMP]: `${TYPES.PODCAST}:${CONVERT_STATUS[podcast.status]}`,
    [FIELDS.TYPE_OWNER_COMP]: `${TYPES.PODCAST}:${podcast.owner}`,
  }),
  STATUS,
  TYPES,
  FIELDS,
};
