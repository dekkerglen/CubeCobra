import { v4 as UUID } from 'uuid';

import CommentType, { UnhydratedComment } from '@utils/datatypes/Comment';
import { CubeImage } from '@utils/datatypes/Cube';
import Comment from '../../src/dynamo/models/comment';
import UserModel from '../../src/dynamo/models/user';
import { getImageData } from 'serverutils/imageutil';
import { createUser } from '../test-utils/data';

// Mock dependencies
jest.mock('../../src/dynamo/util');
jest.mock('../../src/dynamo/models/user');
jest.mock('serverutils/imageutil');
jest.mock('uuid');

// Test helpers
const createUnhydratedComment = (overrides?: Partial<UnhydratedComment>): UnhydratedComment => ({
  id: 'comment-1',
  parent: 'cube-1',
  date: new Date('2024-03-24').valueOf(),
  type: 'cube',
  body: 'Test comment',
  owner: 'user-1',
  ...overrides,
});

const setupQueryResult = (response: any) => {
  (mockDynamoClient.query as jest.Mock).mockResolvedValueOnce(response);
};

const verifyQueryCall = (params: any) => {
  expect(mockDynamoClient.query).toHaveBeenCalledWith(expect.objectContaining(params));
};

describe('Comment Model Initialization', () => {
  it('creates comment table with proper configuration', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../src/dynamo/models/comment');

    expect(mockDynamoCreateClient).toHaveBeenCalledWith({
      name: 'COMMENTS',
      partitionKey: 'id',
      attributes: {
        id: 'S',
        date: 'N',
        parent: 'S',
        owner: 'S',
      },
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
    });
  });
});

describe('Comment Model', () => {
  const mockUser = createUser({
    id: 'user-1',
    username: 'testuser',
    imageName: 'default-avatar',
  });

  const mockImage = {
    id: 'image-1234',
    imageName: 'Test Image',
    uri: 'https://exmaple.com/test.jpg',
    artist: 'First Last',
  } as CubeImage;

  const anonymousUserImage = {
    id: 'image-6666',
    imageName: 'Ambush Viper',
    uri: 'https://exmaple.com/viper.jpg',
    artist: 'FirstA LastA',
  } as CubeImage;

  const mockStoredComment = createUnhydratedComment();

  beforeEach(() => {
    jest.clearAllMocks();
    (UUID as jest.Mock).mockReturnValue('comment-2');
    (getImageData as jest.Mock).mockReturnValue(mockImage);
  });

  describe('getById', () => {
    it('returns undefined when no comment found', async () => {
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: undefined });

      const result = await Comment.getById('comment-999');

      expect(result).toBeUndefined();
    });

    it('returns hydrated comment with owner', async () => {
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: mockStoredComment });
      (UserModel.getById as jest.Mock).mockResolvedValueOnce(mockUser);

      const result = await Comment.getById('comment-1');

      expect(result).toEqual({
        ...mockStoredComment,
        owner: mockUser,
        image: mockImage,
      });
    });

    it.each([
      ['undefined owner', undefined],
      ['null string owner', 'null'],
    ])('handles anonymous comments correctly with %s', async (_, ownerValue) => {
      const anonymousComment = createUnhydratedComment({ owner: ownerValue });
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: anonymousComment });
      (getImageData as jest.Mock).mockReturnValue(anonymousUserImage);

      const result = await Comment.getById('comment-1');

      expect(result).toEqual({
        ...anonymousComment,
        owner: {
          id: '404',
          username: 'Anonymous',
        },
        image: anonymousUserImage,
      });
      expect(UserModel.getById).not.toHaveBeenCalled();
      expect(getImageData).toHaveBeenCalledWith('Ambush Viper');
    });

    it('handles comments with owner 404 as anonymous', async () => {
      const deletedComment = createUnhydratedComment({ owner: '404' });
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: deletedComment });
      (getImageData as jest.Mock).mockReturnValue(anonymousUserImage);

      const result = await Comment.getById('comment-1');

      expect(result).toEqual({
        ...deletedComment,
        owner: {
          id: '404',
          username: 'Anonymous',
        },
        image: anonymousUserImage,
      });
      expect(UserModel.getById).not.toHaveBeenCalled();
      expect(getImageData).toHaveBeenCalledWith('Ambush Viper');
    });
  });

  describe('queryByParentAndType', () => {
    it('returns empty array when no comments found', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: undefined });

      const result = await Comment.queryByParentAndType('cube-1');

      expect(result).toEqual({ items: [], lastKey: undefined });
      verifyQueryCall({
        IndexName: 'ByParent',
        KeyConditionExpression: '#p1 = :parent',
        ExpressionAttributeValues: { ':parent': 'cube-1' },
        Limit: 10,
        ScanIndexForward: false,
      });
    });

    it('returns hydrated comments with pagination', async () => {
      const comments = [createUnhydratedComment({ id: 'comment-1' }), createUnhydratedComment({ id: 'comment-2' })];
      setupQueryResult({
        Items: comments,
        LastEvaluatedKey: { S: 'last-key-1' },
      });
      (UserModel.batchGet as jest.Mock).mockResolvedValueOnce([mockUser]);

      const result = await Comment.queryByParentAndType('cube-1');

      expect(result.items?.length).toBe(2);
      expect(result.lastKey).toEqual({ S: 'last-key-1' });
      result.items?.forEach((item, index) => {
        //Obviously index and id don't align in real world
        expect(item.id).toEqual(`comment-${index + 1}`);
        expect(item.owner).toEqual(mockUser);
        expect(item.image).toEqual(mockImage);
      });
    });

    it('handles comments when no users are found', async () => {
      const comments = [createUnhydratedComment({ id: 'comment-1' }), createUnhydratedComment({ id: 'comment-2' })];
      setupQueryResult({
        Items: comments,
        LastEvaluatedKey: undefined,
      });
      (UserModel.batchGet as jest.Mock).mockResolvedValueOnce([]);
      (getImageData as jest.Mock).mockReturnValue(anonymousUserImage);

      const result = await Comment.queryByParentAndType('cube-1');

      expect(result.items?.length).toBe(2);
      result.items?.forEach((item) => {
        expect(item.owner).toEqual({
          id: '404',
          username: 'Anonymous',
        });
        expect(item.image).toEqual(anonymousUserImage);
      });
      expect(getImageData).toHaveBeenCalledWith('Ambush Viper');
      expect(UserModel.batchGet).toHaveBeenCalledWith(['user-1', 'user-1']);
    });

    it('uses provided lastKey for pagination', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: undefined });

      await Comment.queryByParentAndType('cube-1', { S: 'last-key-1' });

      verifyQueryCall({
        ExclusiveStartKey: { S: 'last-key-1' },
      });
    });

    it('handles falsey Items in response', async () => {
      setupQueryResult({
        Items: null,
        LastEvaluatedKey: undefined,
      });

      const result = await Comment.queryByParentAndType('cube-1');

      expect(result).toEqual({
        items: [],
        lastKey: undefined,
      });
      verifyQueryCall({
        IndexName: 'ByParent',
        KeyConditionExpression: '#p1 = :parent',
        ExpressionAttributeValues: { ':parent': 'cube-1' },
        Limit: 10,
        ScanIndexForward: false,
      });
    });
  });

  describe('queryByOwner', () => {
    it('returns empty array when no comments found', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: undefined });

      const result = await Comment.queryByOwner('user-1');

      expect(result).toEqual({ items: [], lastKey: undefined });
      verifyQueryCall({
        IndexName: 'ByOwner',
        KeyConditionExpression: '#p1 = :owner',
        ExpressionAttributeValues: { ':owner': 'user-1' },
        ScanIndexForward: false,
      });
    });

    it('returns hydrated comments with owner', async () => {
      const comments = [createUnhydratedComment()];
      setupQueryResult({ Items: comments });
      (UserModel.batchGet as jest.Mock).mockResolvedValueOnce([mockUser]);

      const result = await Comment.queryByOwner('user-1');

      expect(result.items?.[0].owner).toEqual(mockUser);
    });

    it('handles comments with falsey owners as anonymous', async () => {
      const comments = [createUnhydratedComment({ owner: undefined }), createUnhydratedComment({ owner: 'null' })];
      setupQueryResult({ Items: comments });
      (getImageData as jest.Mock).mockReturnValue(anonymousUserImage);

      const result = await Comment.queryByOwner('user-1');

      expect(result.items?.length).toBe(2);
      result.items?.forEach((item) => {
        expect(item.owner).toEqual({
          id: '404',
          username: 'Anonymous',
        });
        expect(item.image).toEqual(anonymousUserImage);
      });
      expect(UserModel.batchGet).toHaveBeenCalledWith(['null']);
      expect(getImageData).toHaveBeenCalledWith('Ambush Viper');
    });
  });

  describe('put', () => {
    it('creates new comment with generated id', async () => {
      const newComment = createUnhydratedComment({ id: undefined });

      (UUID as jest.Mock).mockReturnValue('abcdefg-hijklom');

      await Comment.put(newComment);

      expect(UUID).toHaveBeenCalled();
      expect(mockDynamoClient.put).toHaveBeenCalledWith({
        ...newComment,
        id: 'abcdefg-hijklom',
      });
    });

    it('updates existing comment', async () => {
      const updatedComment = { ...mockStoredComment, body: 'New text' };

      await Comment.put(updatedComment);

      expect(UUID).not.toHaveBeenCalled();
      expect(mockDynamoClient.put).toHaveBeenCalledWith(updatedComment);
    });

    it('handles hydrated comments where the owner is an object', async () => {
      const updatedComment = { ...mockStoredComment, owner: mockUser, body: 'New text' } as CommentType;

      await Comment.put(updatedComment);

      expect(UUID).not.toHaveBeenCalled();
      expect(mockDynamoClient.put).toHaveBeenCalledWith({
        ...updatedComment,
        owner: mockUser.id,
      });
    });
  });

  describe('scan', () => {
    it('scans all comments', async () => {
      const comments = [createUnhydratedComment()];
      (mockDynamoClient.scan as jest.Mock).mockResolvedValueOnce({
        Items: comments,
        LastEvaluatedKey: { S: 'last-key-1' },
      });

      const result = await Comment.scan();

      expect(result).toEqual({
        items: comments,
        lastKey: { S: 'last-key-1' },
      });
      expect(mockDynamoClient.scan).toHaveBeenCalledWith({
        ExclusiveStartKey: undefined,
      });
    });

    it('uses lastKey for pagination', async () => {
      (mockDynamoClient.scan as jest.Mock).mockResolvedValueOnce({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      await Comment.scan({ S: 'last-key-1' });

      expect(mockDynamoClient.scan).toHaveBeenCalledWith({
        ExclusiveStartKey: { S: 'last-key-1' },
      });
    });
  });

  describe('createTable', () => {
    it('calls client to create table', async () => {
      await Comment.createTable();

      expect(mockDynamoClient.createTable).toHaveBeenCalled();
    });
  });
});
