import CommentType, { UnhydratedComment } from '@utils/datatypes/Comment';
import { CubeImage } from '@utils/datatypes/Cube';
import { getImageData } from 'serverutils/imageutil';
import { v4 as UUID } from 'uuid';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { CommentDynamoDao } from '../../src/dynamo/dao/CommentDynamoDao';
import UserModel from '../../src/dynamo/models/user';
import { createUser } from '../test-utils/data';

// Mock dependencies
jest.mock('../../src/dynamo/models/user');
jest.mock('serverutils/imageutil');
jest.mock('uuid');

// Mock the DynamoDB client
const mockSend = jest.fn();
const mockDynamoDBClient = {
  send: mockSend,
} as unknown as DynamoDBDocumentClient;

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

describe('CommentDynamoDao', () => {
  let commentDao: CommentDynamoDao;
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
    // Create DAO instance with disabled dual write for testing
    commentDao = new CommentDynamoDao(mockDynamoDBClient, 'test-table', false);
    mockSend.mockReset();
  });

  describe('getById', () => {
    it('returns undefined when no comment found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await commentDao.getById('comment-999');

      expect(result).toBeUndefined();
    });

    it('returns hydrated comment with owner', async () => {
      mockSend.mockResolvedValueOnce({ Item: mockStoredComment });
      (UserModel.getById as jest.Mock).mockResolvedValueOnce(mockUser);

      const result = await commentDao.getById('comment-1');

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
      mockSend.mockResolvedValueOnce({ Item: anonymousComment });
      (getImageData as jest.Mock).mockReturnValue(anonymousUserImage);

      const result = await commentDao.getById('comment-1');

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
      mockSend.mockResolvedValueOnce({ Item: deletedComment });
      (getImageData as jest.Mock).mockReturnValue(anonymousUserImage);

      const result = await commentDao.getById('comment-1');

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

  describe('queryByParent', () => {
    it('returns empty array when no comments found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

      const result = await commentDao.queryByParent('cube-1');

      expect(result).toEqual({ items: [], lastKey: undefined });
    });

    it('returns hydrated comments with pagination', async () => {
      const comments = [createUnhydratedComment({ id: 'comment-1' }), createUnhydratedComment({ id: 'comment-2' })];
      mockSend.mockResolvedValueOnce({
        Items: comments,
        LastEvaluatedKey: { S: 'last-key-1' },
      });
      (UserModel.batchGet as jest.Mock).mockResolvedValueOnce([mockUser]);

      const result = await commentDao.queryByParent('cube-1');

      expect(result.items?.length).toBe(2);
      expect(result.lastKey).toEqual({ S: 'last-key-1' });
      result.items?.forEach((item: CommentType, index: number) => {
        //Obviously index and id don't align in real world
        expect(item.id).toEqual(`comment-${index + 1}`);
        expect(item.owner).toEqual(mockUser);
        expect(item.image).toEqual(mockImage);
      });
    });

    it('handles comments when no users are found', async () => {
      const comments = [createUnhydratedComment({ id: 'comment-1' }), createUnhydratedComment({ id: 'comment-2' })];
      mockSend.mockResolvedValueOnce({
        Items: comments,
        LastEvaluatedKey: undefined,
      });
      (UserModel.batchGet as jest.Mock).mockResolvedValueOnce([]);
      (getImageData as jest.Mock).mockReturnValue(anonymousUserImage);

      const result = await commentDao.queryByParent('cube-1');

      expect(result.items?.length).toBe(2);
      result.items?.forEach((item: CommentType) => {
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
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

      await commentDao.queryByParent('cube-1', { S: 'last-key-1' });

      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('queryByOwner', () => {
    it('returns empty array when no comments found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

      const result = await commentDao.queryByOwner('user-1');

      expect(result).toEqual({ items: [], lastKey: undefined });
    });

    it('returns hydrated comments with owner', async () => {
      const comments = [createUnhydratedComment()];
      mockSend.mockResolvedValueOnce({ Items: comments });
      (UserModel.batchGet as jest.Mock).mockResolvedValueOnce([mockUser]);

      const result = await commentDao.queryByOwner('user-1');

      expect(result.items?.[0].owner).toEqual(mockUser);
    });

    it('handles comments with falsey owners as anonymous', async () => {
      const comments = [createUnhydratedComment({ owner: undefined }), createUnhydratedComment({ owner: 'null' })];
      mockSend.mockResolvedValueOnce({ Items: comments });
      (getImageData as jest.Mock).mockReturnValue(anonymousUserImage);

      const result = await commentDao.queryByOwner('user-1');

      expect(result.items?.length).toBe(2);
      result.items?.forEach((item: CommentType) => {
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
    it('updates existing comment', async () => {
      const updatedComment = { ...mockStoredComment, body: 'New text', owner: mockUser } as CommentType;
      mockSend.mockResolvedValueOnce({});

      await commentDao.put(updatedComment);

      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('createComment', () => {
    it('creates new comment with generated id', async () => {
      const newComment: Omit<CommentType, 'id'> = {
        parent: 'cube-1',
        date: Date.now(),
        type: 'cube',
        body: 'Test comment',
        owner: mockUser,
        image: mockImage,
      };

      (UUID as jest.Mock).mockReturnValue('abcdefg-hijklom');
      mockSend.mockResolvedValueOnce({});

      const result = await commentDao.createComment(newComment);

      expect(UUID).toHaveBeenCalled();
      expect(result.id).toEqual('abcdefg-hijklom');
      expect(result.body).toEqual('Test comment');
      expect(mockSend).toHaveBeenCalled();
    });
  });
});
