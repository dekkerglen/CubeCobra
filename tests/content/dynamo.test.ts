import { v4 as UUID } from 'uuid';

import HydratedContentType, { ContentStatus, ContentType, UnhydratedContent } from '../../src/datatypes/Content';
import Content from '../../src/dynamo/models/content';
import User from '../../src/dynamo/models/user';
import { getBucketName, getObject, putObject } from '../../src/dynamo/s3client';
import { getImageData } from '../../src/util/imageutil';
import {
  createArticle,
  createCardImage,
  createEpisode,
  createPodcast,
  createUser,
  createVideo,
} from '../test-utils/data';

// Mock dependencies
jest.mock('../../src/dynamo/util');
jest.mock('../../src/dynamo/models/user');
jest.mock('../../src/util/imageutil');
jest.mock('../../src/dynamo/s3client');
jest.mock('uuid');

// Test helpers
const createUnhydratedContent = (type: ContentType, overrides?: Partial<UnhydratedContent>): UnhydratedContent => ({
  id: 'content-1',
  type: type,
  typeStatusComp: `${type}:${ContentStatus.PUBLISHED}`,
  typeOwnerComp: `${type}:user-1`,
  status: ContentStatus.PUBLISHED,
  date: new Date('2024-03-24').valueOf(),
  title: 'Test Content',
  owner: 'user-1',
  imageName: 'image-1.jpg',
  short: 'Short description',
  ...overrides,
});

const mockUser = createUser({ id: 'user-1', username: 'testuser' });

const setupQueryResult = (response: any) => {
  (mockDynamoClient.query as jest.Mock).mockResolvedValueOnce(response);
};

const verifyQueryCall = (params: any) => {
  expect(mockDynamoClient.query).toHaveBeenCalledWith(expect.objectContaining(params));
};

const getExpectedDocumentSaved = (content: HydratedContentType, overrides?: Partial<HydratedContentType>): any => {
  const expectedDocument: Record<string, any> = { ...content, ...overrides };
  delete expectedDocument.body;
  delete expectedDocument.image;
  expectedDocument.owner = expectedDocument.owner.id;
  return expectedDocument;
};

describe('Content Model Initialization', () => {
  it('creates content table with proper configuration', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../src/dynamo/models/content');

    expect(mockDynamoCreateClient).toHaveBeenCalledWith({
      name: 'CONTENT',
      partitionKey: 'id',
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
  });
});

describe('Content Model', () => {
  const mockImage = createCardImage({ id: 'image-1', uri: 'test.jpg' });
  const mockStoredContent = createUnhydratedContent(ContentType.ARTICLE);
  const TEST_BUCKET = 'test-bucket';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    (UUID as jest.Mock).mockReturnValue('content-2');
    (getImageData as jest.Mock).mockReturnValue(mockImage);
    (getBucketName as jest.Mock).mockReturnValue(TEST_BUCKET);
  });

  describe('getById', () => {
    it('returns undefined when no content found', async () => {
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: undefined });

      const result = await Content.getById('content-999');

      expect(getObject).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    const hasImageCases = [
      { descriptor: 'Article', type: ContentType.ARTICLE },
      { descriptor: 'Video', type: ContentType.VIDEO },
    ];

    it.each(hasImageCases)('returns hydrated content with owner and image ($descriptor)', async ({ type }) => {
      const storedContent = createUnhydratedContent(type);

      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: storedContent });
      (User.getById as jest.Mock).mockResolvedValueOnce(mockUser);
      (getObject as jest.Mock).mockResolvedValueOnce('Test body content');

      const result = await Content.getById('content-1');

      expect(getObject).toHaveBeenCalledWith(TEST_BUCKET, `content/${storedContent.id}.json`);
      expect(result).toEqual({
        ...storedContent,
        owner: mockUser,
        image: mockImage,
        body: 'Test body content',
      });
    });

    const doesNotHaveImageCases = [
      { descriptor: 'Episode', type: ContentType.EPISODE },
      { descriptor: 'Podcast', type: ContentType.PODCAST },
    ];

    it.each(doesNotHaveImageCases)('returns hydrated content with only owner ($descriptor)', async ({ type }) => {
      const storedContent = createUnhydratedContent(type);

      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: storedContent });
      (User.getById as jest.Mock).mockResolvedValueOnce(mockUser);
      (getObject as jest.Mock).mockResolvedValueOnce('Test body content');

      const result = await Content.getById('content-1');

      expect(getObject).toHaveBeenCalledWith(TEST_BUCKET, `content/${storedContent.id}.json`);
      expect(result).toEqual({
        ...storedContent,
        owner: mockUser,
        body: 'Test body content',
      });
    });

    it('handles content with no body', async () => {
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: mockStoredContent });
      (User.getById as jest.Mock).mockResolvedValueOnce(mockUser);
      (getObject as jest.Mock).mockRejectedValueOnce(new Error('Not found'));

      const result = await Content.getById('content-1');

      expect(result).toEqual({
        ...mockStoredContent,
        owner: mockUser,
        image: mockImage,
      });
    });

    it('handles content with empty owner or image', async () => {
      const storedContent = { ...mockStoredContent };
      storedContent.owner = '';
      storedContent.imageName = '';

      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: storedContent });
      (getObject as jest.Mock).mockResolvedValueOnce('Test body content');

      const result = await Content.getById('content-1');

      expect(User.getById).not.toHaveBeenCalled();
      expect(getImageData).not.toHaveBeenCalled();
      expect(result).toEqual({
        ...storedContent,
        body: 'Test body content',
        owner: undefined,
        image: undefined,
      });
    });
  });

  describe('getByStatus', () => {
    it('returns empty result when no content found', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: undefined });

      const result = await Content.getByStatus('published');

      expect(result).toEqual({ items: [], lastKey: undefined });
      verifyQueryCall({
        IndexName: 'ByStatus',
        KeyConditionExpression: '#p1 = :status',
        ExpressionAttributeValues: { ':status': 'published' },
        ScanIndexForward: false,
      });
    });

    it('returns hydrated content, but that doesnt include bodies', async () => {
      const mockStoredContentTwo = createUnhydratedContent(ContentType.VIDEO, { id: 'content-555', owner: 'user-434' });
      const mockUserTwo = createUser({ id: 'user-434' });
      const mockImageTwo = createCardImage({ imageName: 'foobaz' });

      (getImageData as jest.Mock).mockReturnValueOnce(mockImage);
      (getImageData as jest.Mock).mockReturnValueOnce(mockImageTwo);

      const contents = [mockStoredContent, mockStoredContentTwo];
      setupQueryResult({
        Items: contents,
        LastEvaluatedKey: { S: 'last-key-1' },
      });
      (User.batchGet as jest.Mock).mockResolvedValueOnce([mockUser, mockUserTwo]);

      const result = await Content.getByStatus('published');

      expect(result.items?.length).toBe(2);
      expect(result.lastKey).toEqual({ S: 'last-key-1' });
      expect(result.items?.[0]).toEqual({
        ...mockStoredContent,
        owner: mockUser,
        image: mockImage,
      });
      expect(result.items?.[1]).toEqual({
        ...mockStoredContentTwo,
        owner: mockUserTwo,
        image: mockImageTwo,
      });
      expect(getObject).toHaveBeenCalledTimes(0);
      expect(User.batchGet).toHaveBeenCalledWith([mockUser.id, mockUserTwo.id]);
    });

    it('handles content with empty owner or image', async () => {
      const mockStoredContentOne = { ...mockStoredContent };
      mockStoredContentOne.imageName = '';

      const mockStoredContentTwo = createUnhydratedContent(ContentType.ARTICLE, { id: 'content-555', owner: '' });
      const mockImageTwo = createCardImage({ imageName: 'foobaz' });

      (getImageData as jest.Mock).mockReturnValueOnce(mockImageTwo);

      const contents = [mockStoredContentOne, mockStoredContentTwo];
      setupQueryResult({
        Items: contents,
        LastEvaluatedKey: { S: 'last-key-1' },
      });
      (User.batchGet as jest.Mock).mockResolvedValueOnce([mockUser]);

      const result = await Content.getByStatus('published');

      expect(result.items?.length).toBe(2);
      expect(result.lastKey).toEqual({ S: 'last-key-1' });
      expect(result.items?.[0]).toEqual({
        ...mockStoredContentOne,
        owner: mockUser,
        image: undefined,
      });
      expect(result.items?.[1]).toEqual({
        ...mockStoredContentTwo,
        owner: undefined,
        image: mockImageTwo,
      });
      expect(getObject).toHaveBeenCalledTimes(0);
      //Empty string is apparently not falsely enough to be filtered
      expect(User.batchGet).toHaveBeenCalledWith([mockUser.id, '']);
    });
  });

  //Hydration logic already tested by getByStatus
  describe('getByTypeAndStatus', () => {
    it('any string for status is allowed', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: undefined });

      const result = await Content.getByTypeAndStatus(ContentType.PODCAST, 'foobar');

      expect(result).toEqual({ items: [], lastKey: undefined });
      verifyQueryCall({
        IndexName: 'ByTypeStatusComp',
        KeyConditionExpression: '#p1 = :stcomp',
        ExpressionAttributeValues: { ':stcomp': `${ContentType.PODCAST}:foobar` },
        ScanIndexForward: false,
      });
    });

    it('with status from enum', async () => {
      setupQueryResult({ Items: [mockStoredContent], LastEvaluatedKey: { S: 'last-key-1' } });
      (User.batchGet as jest.Mock).mockResolvedValueOnce([mockUser]);

      const result = await Content.getByTypeAndStatus(ContentType.PODCAST, ContentStatus.IN_REVIEW);

      expect(result.items?.length).toBe(1);
      expect(result.lastKey).toEqual({ S: 'last-key-1' });
      expect(result.items?.[0]).toEqual({
        ...mockStoredContent,
        owner: mockUser,
        image: mockImage,
      });
      verifyQueryCall({
        IndexName: 'ByTypeStatusComp',
        KeyConditionExpression: '#p1 = :stcomp',
        ExpressionAttributeValues: { ':stcomp': `${ContentType.PODCAST}:${ContentStatus.IN_REVIEW}` },
        ScanIndexForward: false,
      });
    });
  });

  describe('getByTypeAndOwner', () => {
    it('returns hydrated items', async () => {
      setupQueryResult({ Items: [mockStoredContent], LastEvaluatedKey: { S: 'last-key-55' } });
      (User.batchGet as jest.Mock).mockResolvedValueOnce([mockUser]);

      const result = await Content.getByTypeAndOwner(ContentType.VIDEO, 'user-123445');

      expect(result.items?.length).toBe(1);
      expect(result.lastKey).toEqual({ S: 'last-key-55' });
      expect(result.items?.[0]).toEqual({
        ...mockStoredContent,
        owner: mockUser,
        image: mockImage,
      });
      verifyQueryCall({
        IndexName: 'ByTypeOwnerComp',
        KeyConditionExpression: '#p1 = :tocomp',
        ExpressionAttributeValues: { ':tocomp': `${ContentType.VIDEO}:user-123445` },
        ScanIndexForward: false,
      });
    });

    it('starts the query from the input lastKey', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: null });
      (User.batchGet as jest.Mock).mockResolvedValueOnce([mockUser]);

      const result = await Content.getByTypeAndOwner(ContentType.VIDEO, 'user-123445', { S: 'keyabc' });

      expect(result.items?.length).toBe(0);
      expect(result.lastKey).toBeNull();
      verifyQueryCall({
        IndexName: 'ByTypeOwnerComp',
        KeyConditionExpression: '#p1 = :tocomp',
        ExpressionAttributeValues: { ':tocomp': `${ContentType.VIDEO}:user-123445` },
        ScanIndexForward: false,
        ExclusiveStartKey: { S: 'keyabc' },
      });
    });
  });

  describe('put', () => {
    it('creates new content with generated id', async () => {
      const newContent = createVideo({ id: undefined });
      const expectedBody = newContent.body;

      const expectedDocument = getExpectedDocumentSaved(newContent, { id: 'content-2' });

      await Content.put(newContent, ContentType.VIDEO);

      expect(UUID).toHaveBeenCalled();
      expect(putObject).toHaveBeenCalledWith(TEST_BUCKET, 'content/content-2.json', expectedBody);
      expect(mockDynamoClient.put).toHaveBeenCalledWith(expectedDocument);
    });

    const stringImageCases = [
      { descriptor: 'Episode', type: ContentType.EPISODE },
      { descriptor: 'Podcast', type: ContentType.PODCAST },
    ];

    it.each(stringImageCases)(
      'image is preserved when it is a string not an object ($descriptor)',
      async ({ type }) => {
        const createFunction = type === ContentType.EPISODE ? createEpisode : createPodcast;

        const newContent = createFunction({ id: 'abcdefg-346436' });
        const expectedBody = newContent.body;

        const expectedDocument = getExpectedDocumentSaved(newContent, { id: 'abcdefg-346436' });
        expectedDocument.image = newContent.image;

        await Content.put(newContent, type);

        expect(putObject).toHaveBeenCalledWith(TEST_BUCKET, 'content/abcdefg-346436.json', expectedBody);
        expect(mockDynamoClient.put).toHaveBeenCalledWith(expectedDocument);
      },
    );

    const objectImageCases = [
      { descriptor: 'Article', type: ContentType.ARTICLE },
      { descriptor: 'Video', type: ContentType.VIDEO },
    ];

    it.each(objectImageCases)('image is stripped when it is an object ($descriptor)', async ({ type }) => {
      const createFunction = type === ContentType.ARTICLE ? createArticle : createVideo;

      const newContent = createFunction({ id: 'abcdefg-346436' });
      const expectedBody = newContent.body;

      const expectedDocument = getExpectedDocumentSaved(newContent, { id: 'abcdefg-346436' });

      await Content.put(newContent, type);

      expect(putObject).toHaveBeenCalledWith(TEST_BUCKET, 'content/abcdefg-346436.json', expectedBody);
      expect(mockDynamoClient.put).toHaveBeenCalledWith(expectedDocument);
    });

    it('handles empty body', async () => {
      const newContent = createArticle({ body: '' });

      const expectedDocument = getExpectedDocumentSaved(newContent);

      await Content.put(newContent, ContentType.ARTICLE);

      expect(putObject).not.toHaveBeenCalled();
      expect(mockDynamoClient.put).toHaveBeenCalledWith(expectedDocument);
    });

    it('handles owner being a string not an User object', async () => {
      const newContent = createPodcast({
        body: '',
        //@ts-expect-error -- Owner can be a string if working with unhydrated Content (such as from scan)
        owner: 'user-123456',
        typeOwnerComp: `${ContentType.PODCAST}:user-123456`,
      });

      const expectedDocument: Record<string, any> = { ...newContent };
      delete expectedDocument.body;

      await Content.put(newContent, ContentType.PODCAST);

      expect(putObject).not.toHaveBeenCalled();
      expect(mockDynamoClient.put).toHaveBeenCalledWith(expectedDocument);
    });

    it('throws error when updating without id', async () => {
      const invalidContent = createVideo({ id: undefined });

      await expect(Content.update(invalidContent)).rejects.toThrow('Invalid document: No partition key provided');
    });
  });

  describe('batchPut', () => {
    it('handles multiple content types', async () => {
      const video = createVideo({
        id: 'video-123',
        body: 'video body',
      });
      const podcast = createPodcast({
        id: 'podcast-456',
        body: 'podcast body',
      });

      const expectedVideoDocument = getExpectedDocumentSaved(video);
      const expectedPodcastDocument = getExpectedDocumentSaved(podcast);
      expectedPodcastDocument.image = podcast.image; // Podcast preserves string image

      await Content.batchPut([video, podcast]);

      expect(putObject).toHaveBeenCalledTimes(2);
      expect(putObject).toHaveBeenCalledWith(TEST_BUCKET, 'content/video-123.json', 'video body');
      expect(putObject).toHaveBeenCalledWith(TEST_BUCKET, 'content/podcast-456.json', 'podcast body');

      expect(mockDynamoClient.batchPut).toHaveBeenCalledWith([
        {
          document: expectedVideoDocument,
          body: 'video body',
        },
        {
          document: expectedPodcastDocument,
          body: 'podcast body',
        },
      ]);
    });
  });

  //Same logic as put for what is written to dynamo vs S3
  describe('update', () => {
    it('updates existing content', async () => {
      const existingContent = createEpisode({ id: 'article-abcdefg', short: 'New short descr' });
      const expectedBody = existingContent.body;

      const expectedDocument = getExpectedDocumentSaved(existingContent);
      expectedDocument.image = existingContent.image;

      await Content.update(existingContent);

      expect(UUID).not.toHaveBeenCalled();
      expect(putObject).toHaveBeenCalledWith(TEST_BUCKET, 'content/article-abcdefg.json', expectedBody);
      expect(mockDynamoClient.put).toHaveBeenCalledWith(expectedDocument);
    });
  });

  describe('batchDelete', () => {
    it('deletes multiple content items', async () => {
      const keys = [{ id: 'content-1' }, { id: 'content-2' }];

      await Content.batchDelete(keys);

      expect(mockDynamoClient.batchDelete).toHaveBeenCalledWith(keys);
    });
  });

  describe('scan', () => {
    it('returns unhydrated content with pagination', async () => {
      (mockDynamoClient.scan as jest.Mock).mockResolvedValueOnce({
        Items: [mockStoredContent],
        LastEvaluatedKey: { S: 'last-key-1' },
      });

      const result = await Content.scan({ S: 'start-key-1' });

      expect(result).toEqual({
        items: [mockStoredContent],
        lastKey: { S: 'last-key-1' },
      });
      expect(mockDynamoClient.scan).toHaveBeenCalledWith({
        ExclusiveStartKey: { S: 'start-key-1' },
      });
    });
  });

  describe('createTable', () => {
    it('delegates to client createTable', async () => {
      const expectedResponse = { TableName: 'CONTENT' };
      (mockDynamoClient.createTable as jest.Mock).mockResolvedValueOnce(expectedResponse);

      const result = await Content.createTable();

      expect(result).toEqual(expectedResponse);
      expect(mockDynamoClient.createTable).toHaveBeenCalled();
    });
  });
});
