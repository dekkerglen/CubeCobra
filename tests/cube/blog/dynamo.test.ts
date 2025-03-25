import BlogPost, { UnhydratedBlogPost } from '../../../src/datatypes/BlogPost';
import Blog from '../../../src/dynamo/models/blog';
import * as carddb from '../../../src/util/carddb';
import { createBlogPost, createCard, createChangelog, createCube, createUser } from '../../test-utils/data';

// Mock dependencies
jest.mock('../../../src/dynamo/models/cube');
jest.mock('../../../src/dynamo/models/changelog');
jest.mock('../../../src/dynamo/models/user');
jest.mock('../../../src/util/carddb');

import Changelog from '../../../src/dynamo/models/changelog';
import Cube from '../../../src/dynamo/models/cube';
import User from '../../../src/dynamo/models/user';

// Test helpers
const createUnhydratedBlogPost = (overrides?: Partial<UnhydratedBlogPost>): UnhydratedBlogPost =>
  ({
    id: 'blog-post-99999',
    ...overrides,
  }) as UnhydratedBlogPost;

const setupQueryResult = (response: any) => {
  (mockDynamoClient.query as jest.Mock).mockResolvedValueOnce(response);
};

const verifyQueryCall = (params: any) => {
  expect(mockDynamoClient.query).toHaveBeenCalledWith(expect.objectContaining(params));
};

const setupHydrationMocks = (user: any, cube: any, changelog: any) => {
  (User.getById as jest.Mock).mockResolvedValueOnce(user);
  (Cube.getById as jest.Mock).mockResolvedValueOnce(cube);
  (Changelog.getById as jest.Mock).mockResolvedValueOnce(changelog);
};

const verifyHydrationCalls = (blog: any) => {
  expect(User.getById).toHaveBeenCalledWith(blog.owner);
  if (blog.cube !== 'DEVBLOG') {
    expect(Cube.getById).toHaveBeenCalledWith(blog.cube);
  }
  if (blog.changelist) {
    expect(Changelog.getById).toHaveBeenCalledWith(blog.cube, blog.changelist);
  }
};

// First test createClient configuration
describe('Blog Model Initialization', () => {
  it('blog table created with proper configuration', async () => {
    // Import to trigger createClient
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../../src/dynamo/models/blog');

    expect(mockDynamoCreateClient).toHaveBeenCalledWith({
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
  });
});

// Test data setup
describe('Blog Model', () => {
  const mockUser = createUser({ id: 'user-123' });
  const mockCube = createCube({ id: 'cube-123', name: 'My Cube', owner: mockUser });
  const mockChangelog = createChangelog({
    mainboard: { adds: [createCard()] },
    maybeboard: undefined,
  });

  const mockStoredBlog = createUnhydratedBlogPost({
    id: 'blog-123',
    owner: 'user-123',
    title: 'Test Blog',
    body: 'Test content',
    date: new Date('2024-03-24').valueOf(),
    cube: 'cube-123',
    changelist: 'changelog-id-5235',
  });

  let mockBlog: BlogPost;

  const mockNewBlog = createUnhydratedBlogPost({
    id: undefined,
    owner: 'user-123',
    title: 'Test Blog',
    body: 'Test content',
    date: undefined,
    cube: 'cube-123',
    changelist: undefined,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    const temp = { ...mockStoredBlog };
    delete temp.changelist;

    mockBlog = createBlogPost({
      ...temp,
      id: 'blog-123',
      owner: mockUser,
      cubeName: 'My Cube',
      Changelog: mockChangelog,
    });
  });

  describe('getById', () => {
    it('returns undefined when no blog found', async () => {
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: undefined });
      const result = await Blog.getById('nonexistent');
      expect(result).toBeUndefined();
    });

    it('returns hydrated blog with all related objects', async () => {
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: mockStoredBlog });
      setupHydrationMocks(mockUser, mockCube, mockChangelog);

      const result = await Blog.getById(mockBlog.id);

      expect(result).toEqual(mockBlog);
      verifyHydrationCalls(mockStoredBlog);
    });

    it('returns hydrated blog without changelog', async () => {
      const storedBlog = { ...mockStoredBlog };
      storedBlog.changelist = undefined;
      const hydratedBlog = { ...mockBlog };
      hydratedBlog.Changelog = undefined;

      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({
        Item: storedBlog,
      });

      (User.getById as jest.Mock).mockResolvedValueOnce(mockUser);
      (Cube.getById as jest.Mock).mockResolvedValueOnce(mockCube);

      const result = await Blog.getById(storedBlog.id!);
      expect(result).toEqual(hydratedBlog);
      expect(User.getById).toHaveBeenCalledWith(storedBlog.owner);
      expect(Cube.getById).toHaveBeenCalledWith(storedBlog.cube);
      expect(Changelog.getById).not.toHaveBeenCalled();
    });

    it('returns hydrated blog when cube isnt found', async () => {
      const storedBlog = { ...mockStoredBlog };
      storedBlog.cube = 'cube-id-not-found';
      const hydratedBlog = { ...mockBlog };
      hydratedBlog.cube = storedBlog.cube;
      hydratedBlog.cubeName = 'Unknown';

      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({
        Item: storedBlog,
      });

      (User.getById as jest.Mock).mockResolvedValueOnce(mockUser);
      (Cube.getById as jest.Mock).mockResolvedValueOnce(null);
      (Changelog.getById as jest.Mock).mockResolvedValueOnce(mockChangelog);

      const result = await Blog.getById(storedBlog.id!);
      expect(result).toEqual(hydratedBlog);
      expect(User.getById).toHaveBeenCalledWith(storedBlog.owner);
      expect(Cube.getById).toHaveBeenCalledWith(storedBlog.cube);
      expect(Changelog.getById).toHaveBeenCalledWith(storedBlog.cube, storedBlog.changelist);
    });

    it('returns hydrated blog with no cube details if the cube is the special "DEVBLOG"', async () => {
      const storedBlog = { ...mockStoredBlog };
      storedBlog.cube = 'DEVBLOG';
      const hydratedBlog = { ...mockBlog };
      hydratedBlog.cube = storedBlog.cube;
      hydratedBlog.cubeName = 'Unknown';

      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({
        Item: storedBlog,
      });

      (User.getById as jest.Mock).mockResolvedValueOnce(mockUser);
      (Changelog.getById as jest.Mock).mockResolvedValueOnce(mockChangelog);

      const result = await Blog.getById(storedBlog.id!);
      expect(result).toEqual(hydratedBlog);
      expect(User.getById).toHaveBeenCalledWith(storedBlog.owner);
      expect(Cube.getById).not.toHaveBeenCalled();
      expect(Changelog.getById).toHaveBeenCalledWith(storedBlog.cube, storedBlog.changelist);
    });

    it('defaults body to empty string if not set', async () => {
      const storedBlog = { ...mockStoredBlog };
      storedBlog.body = undefined;
      const hydratedBlog = { ...mockBlog };
      hydratedBlog.cube = storedBlog.cube;
      hydratedBlog.cubeName = 'Unknown';
      hydratedBlog.body = '';
      hydratedBlog.Changelog = undefined;

      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({
        Item: storedBlog,
      });

      (User.getById as jest.Mock).mockResolvedValueOnce(hydratedBlog.owner);
      (Cube.getById as jest.Mock).mockResolvedValueOnce(undefined);
      (Changelog.getById as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await Blog.getById(storedBlog.id!);
      expect(result).toEqual(hydratedBlog);
    });
  });

  describe('getUnhydrated', () => {
    it('returns unhydrated blog', async () => {
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({
        Item: mockStoredBlog,
      });

      const result = await Blog.getUnhydrated(mockStoredBlog.id!);
      expect(result).toEqual(mockStoredBlog);
    });
  });

  describe('getByCube', () => {
    it('returns empty array when no blogs found', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: null });

      const result = await Blog.getByCube(mockCube.id, 5);

      expect(result).toEqual({ items: [], lastKey: null });
      verifyQueryCall({
        IndexName: 'ByCube',
        ExpressionAttributeValues: { ':cube': mockCube.id },
        ExpressionAttributeNames: { '#p1': 'cube' },
      });
    });

    it('returns empty array Items are falsey', async () => {
      setupQueryResult({ Items: undefined, LastEvaluatedKey: null });

      const result = await Blog.getByCube(mockCube.id, 5);
      expect(result).toEqual({ items: [], lastKey: null });

      verifyQueryCall({
        IndexName: 'ByCube',
        ExpressionAttributeValues: {
          ':cube': mockCube.id,
        },
        ExpressionAttributeNames: {
          '#p1': 'cube',
        },
      });
    });

    it('default limit if the input is falsey', async () => {
      setupQueryResult({ Items: undefined, LastEvaluatedKey: null });

      const result = await Blog.getByCube(mockCube.id, 0);
      expect(result).toEqual({ items: [], lastKey: null });

      verifyQueryCall({
        IndexName: 'ByCube',
        ExpressionAttributeValues: {
          ':cube': mockCube.id,
        },
        ExpressionAttributeNames: {
          '#p1': 'cube',
        },
        Limit: 36,
      });
    });

    it('returns hydrated blogs of the cube', async () => {
      const blog1 = { ...mockStoredBlog, owner: 'user-1234', changelist: 'changelist-1234' };
      const blog2 = { ...mockStoredBlog, id: 'blog-456', owner: 'user-5678', changelist: 'changelist-5678' };

      const user1 = { ...mockUser, id: 'user-1234' };
      const user2 = { ...mockUser, id: 'user-5678' };

      const changelog1 = { ...mockChangelog, id: 'changelist-1234' };
      const changelog2 = { ...mockChangelog, id: 'changelist-5678' };

      setupQueryResult({
        Items: [blog1, blog2],
        LastEvaluatedKey: { S: 'foobar' },
      });

      (User.batchGet as jest.Mock).mockResolvedValueOnce([user1, user2]);
      (Cube.batchGet as jest.Mock).mockResolvedValueOnce([mockCube]);
      (Changelog.batchGet as jest.Mock).mockResolvedValueOnce([changelog1, changelog2]);

      const result = await Blog.getByCube(mockCube.id, 5);

      expect(result.lastKey).toEqual({ S: 'foobar' });
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toEqual(blog1.id);
      expect(result.items[0]?.cubeName).toEqual(mockCube.name);
      expect(result.items[0]?.owner).toEqual(user1);
      expect(result.items[0]?.Changelog).toEqual(changelog1);

      expect(result.items[1]?.id).toEqual(blog2.id);
      expect(result.items[1]?.cubeName).toEqual(mockCube.name);
      expect(result.items[1]?.owner).toEqual(user2);
      expect(result.items[1]?.Changelog).toEqual(changelog2);

      expect(User.batchGet).toHaveBeenCalledWith([user1.id, user2.id]);
      expect(Cube.batchGet).toHaveBeenCalledWith([mockCube.id, mockCube.id]);
      expect(Changelog.batchGet).toHaveBeenCalledWith([
        { id: changelog1.id, cube: mockCube.id },
        { id: changelog2.id, cube: mockCube.id },
      ]);

      verifyQueryCall({
        IndexName: 'ByCube',
        ExpressionAttributeValues: {
          ':cube': mockCube.id,
        },
        ExpressionAttributeNames: {
          '#p1': 'cube',
        },
        Limit: 5,
      });
    });

    it('returns hydrated blogs of the cube, with missing related objects', async () => {
      const blog1 = { ...mockStoredBlog, owner: 'user-66666', changelist: 'changelist-1234' };
      const blog2 = { ...mockStoredBlog, id: 'blog-456', owner: 'user-1234', changelist: 'changelist-7457457' };

      const user1 = { ...mockUser, id: 'user-1234' };

      const changelog1 = { ...mockChangelog, id: 'changelist-1234' };

      setupQueryResult({
        Items: [blog1, blog2],
        LastEvaluatedKey: null,
      });

      (User.batchGet as jest.Mock).mockResolvedValueOnce([user1]);
      (Cube.batchGet as jest.Mock).mockResolvedValueOnce([]);
      (Changelog.batchGet as jest.Mock).mockResolvedValueOnce([changelog1]);

      const result = await Blog.getByCube(mockCube.id, 77);

      expect(result.lastKey).toBeNull();
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toEqual(blog1.id);
      expect(result.items[0]?.cubeName).toEqual('Unknown');
      expect(result.items[0]?.owner).toEqual(undefined);
      expect(result.items[0]?.Changelog).toEqual(changelog1);

      expect(result.items[1]?.id).toEqual(blog2.id);
      expect(result.items[1]?.cubeName).toEqual('Unknown');
      expect(result.items[1]?.owner).toEqual(user1);
      expect(result.items[1]?.Changelog).toEqual(undefined);

      expect(User.batchGet).toHaveBeenCalledWith(['user-66666', user1.id]);
      expect(Cube.batchGet).toHaveBeenCalledWith([mockCube.id, mockCube.id]);
      expect(Changelog.batchGet).toHaveBeenCalledWith([
        { id: changelog1.id, cube: mockCube.id },
        { id: 'changelist-7457457', cube: mockCube.id },
      ]);

      verifyQueryCall({
        Limit: 77,
      });
    });
  });

  //getByCube and getByOwner share hydration logic so we don't need both to have full sets of conditional tests
  describe('getByOwner', () => {
    it('returns empty array when no blogs found', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: null });

      const result = await Blog.getByOwner(mockUser.id, 5);
      expect(result).toEqual({ items: [], lastKey: null });

      verifyQueryCall({
        IndexName: 'ByOwner',
        ExpressionAttributeValues: {
          ':owner': mockUser.id,
        },
        ExpressionAttributeNames: {
          '#p1': 'owner',
        },
      });
    });

    it('returns empty array when items are falsey', async () => {
      setupQueryResult({ Items: false, LastEvaluatedKey: null });

      const result = await Blog.getByOwner(mockUser.id, 5);
      expect(result).toEqual({ items: [], lastKey: null });

      verifyQueryCall({
        IndexName: 'ByOwner',
        ExpressionAttributeValues: {
          ':owner': mockUser.id,
        },
        ExpressionAttributeNames: {
          '#p1': 'owner',
        },
      });
    });

    it('default limit if input is falsey', async () => {
      setupQueryResult({ Items: [], LastEvaluatedKey: null });

      const result = await Blog.getByOwner(mockUser.id, 0);
      expect(result).toEqual({ items: [], lastKey: null });

      verifyQueryCall({
        IndexName: 'ByOwner',
        ExpressionAttributeValues: {
          ':owner': mockUser.id,
        },
        ExpressionAttributeNames: {
          '#p1': 'owner',
        },
        Limit: 36,
      });
    });

    it('returns all blogs for owner', async () => {
      const blog1 = { ...mockStoredBlog, owner: 'user-1234', changelist: undefined, cube: 'cube-1234' };
      const blog2 = { ...mockStoredBlog, id: 'blog-456', owner: 'user-1234', changelist: undefined, cube: 'cube-5678' };

      const user1 = { ...mockUser, id: 'user-1234' };

      const cube1 = { ...mockCube, id: 'cube-1234' };
      const cube2 = { ...mockCube, id: 'cube-5678' };

      setupQueryResult({
        Items: [blog1, blog2],
        LastEvaluatedKey: { S: 'foobar' },
      });

      (User.batchGet as jest.Mock).mockResolvedValueOnce([user1]);
      (Cube.batchGet as jest.Mock).mockResolvedValueOnce([cube1, cube2]);
      (Changelog.batchGet as jest.Mock).mockResolvedValueOnce([]);

      const result = await Blog.getByOwner(user1.id, 5, { S: 'keyABC' });

      expect(result.lastKey).toEqual({ S: 'foobar' });
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toEqual(blog1.id);
      expect(result.items[0]?.cubeName).toEqual(cube1.name);
      expect(result.items[0]?.owner).toEqual(user1);
      expect(result.items[0]?.Changelog).toBeUndefined();

      expect(result.items[1]?.id).toEqual(blog2.id);
      expect(result.items[1]?.cubeName).toEqual(cube2.name);
      expect(result.items[1]?.owner).toEqual(user1);
      expect(result.items[1]?.Changelog).toBeUndefined();

      expect(User.batchGet).toHaveBeenCalledWith([user1.id, user1.id]);
      expect(Cube.batchGet).toHaveBeenCalledWith([cube1.id, cube2.id]);
      expect(Changelog.batchGet).toHaveBeenCalledWith([]);

      verifyQueryCall({
        IndexName: 'ByOwner',
        ExpressionAttributeValues: {
          ':owner': user1.id,
        },
        ExpressionAttributeNames: {
          '#p1': 'owner',
        },
        ExclusiveStartKey: { S: 'keyABC' },
      });
    });
  });

  describe('put', () => {
    it('saves blog with generated id and date if none provided', async () => {
      const id = await Blog.put(mockNewBlog);

      expect(mockDynamoClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          owner: mockNewBlog.owner,
          title: mockNewBlog.title,
          body: mockNewBlog.body,
          cube: mockNewBlog.cube,
          date: expect.any(Number),
          changelist: mockNewBlog.changelist,
        }),
      );
      expect(typeof id).toBe('string');
    });

    it('saves blog and uses existing id and date if set', async () => {
      const filledBlogPost = mockNewBlog;
      filledBlogPost.id = 'blog-post-12345';
      filledBlogPost.date = 1742855772000;

      const id = await Blog.put(filledBlogPost);

      expect(mockDynamoClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'blog-post-12345',
          date: 1742855772000,
        }),
      );
      expect(id).toEqual('blog-post-12345');
    });

    it('blog bodies are limited to 10000 characters', async () => {
      const filledBlogPost = mockNewBlog;
      filledBlogPost.body = 'x'.repeat(10050);

      await Blog.put(filledBlogPost);

      expect(mockDynamoClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'x'.repeat(10000),
        }),
      );
    });

    it('body defaults to undefined if falsey', async () => {
      const filledBlogPost = mockNewBlog;
      filledBlogPost.body = '';

      await Blog.put(filledBlogPost);

      expect(mockDynamoClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          body: undefined,
        }),
      );
    });
  });

  describe('delete', () => {
    it('deletes blog by id', async () => {
      await Blog.delete(mockBlog.id);
      expect(mockDynamoClient.delete).toHaveBeenCalledWith({ id: mockBlog.id });
    });
  });

  describe('createTable', () => {
    it('calls client to create table', async () => {
      await Blog.createTable();

      expect(mockDynamoClient.createTable).toHaveBeenCalled();
    });
  });

  describe('batchPut', () => {
    it('saves multiple blog posts with required fields', async () => {
      const blogs = [
        { ...mockNewBlog, title: 'Blog 1' },
        { ...mockNewBlog, title: 'Blog 2', id: undefined },
      ];

      await Blog.batchPut(blogs);

      expect(mockDynamoClient.batchPut).toHaveBeenCalledWith([
        expect.objectContaining({
          id: expect.any(String),
          date: expect.any(Number),
          title: 'Blog 1',
        }),
        expect.objectContaining({
          id: expect.any(String),
          date: expect.any(Number),
          title: 'Blog 2',
        }),
      ]);
    });

    it('truncates long bodies in batch put', async () => {
      const blogs = [
        { ...mockNewBlog, body: 'x'.repeat(10500) },
        { ...mockNewBlog, body: 'y'.repeat(9000) },
      ];

      await Blog.batchPut(blogs);

      expect(mockDynamoClient.batchPut).toHaveBeenCalledWith([
        expect.objectContaining({
          body: 'x'.repeat(10000),
        }),
        expect.objectContaining({
          body: 'y'.repeat(9000),
        }),
      ]);
    });
  });

  //Hydration logic tested by other functions
  describe('batchGet', () => {
    it('returns empty array when no ids provided', async () => {
      (mockDynamoClient.batchGet as jest.Mock).mockResolvedValueOnce([]);

      const result = await Blog.batchGet([]);
      expect(result).toEqual([]);
    });

    it('returns hydrated blog posts', async () => {
      const stored1 = { ...mockStoredBlog, id: 'blog1' };
      const stored2 = { ...mockStoredBlog, id: 'blog2' };

      (User.batchGet as jest.Mock).mockResolvedValueOnce([]);
      (Cube.batchGet as jest.Mock).mockResolvedValueOnce([]);
      (Changelog.batchGet as jest.Mock).mockResolvedValueOnce([]);

      mockDynamoClient.batchGet.mockResolvedValueOnce([stored2, stored1]);

      const result = await Blog.batchGet(['blog1', 'blog2']);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('blog2');
      expect(result[1]?.id).toBe('blog1');
      expect(mockDynamoClient.batchGet).toHaveBeenCalledWith([stored1.id, stored2.id]);
    });
  });

  describe('changelogToText', () => {
    const cardAdd1 = createCard({ cardID: '1' });
    const cardAdd2 = createCard({ cardID: '2' });

    beforeEach(() => {
      (carddb.cardFromId as jest.Mock).mockImplementation((id) => ({
        name: `Card ${id}`,
      }));
    });

    it('generates text for adds and removes', () => {
      const changelog = {
        mainboard: {
          adds: [cardAdd1, cardAdd2],
          removes: [
            { index: 55, oldCard: { cardID: '3' } },
            { index: 98, oldCard: { cardID: '4' } },
          ],
        },
      };

      const result = Blog.changelogToText(changelog);

      expect(result).toContain('Added:\nCard 1\nCard 2\n');
      expect(result).toContain('Removed:\nCard 3\nCard 4\n');
    });

    it('generates text for swaps and edits', () => {
      const changelog = {
        mainboard: {
          swaps: [
            { index: 55, oldCard: { cardID: '1' }, card: { cardID: '2' } },
            { index: 98, oldCard: { cardID: '3' }, card: { cardID: '4' } },
          ],
          edits: [
            { index: 23, oldCard: { cardID: '5' }, newCard: { cardID: '5', tags: ['Foobar'] } },
            { index: 44, oldCard: { cardID: '6' }, newCard: { cardID: '88' } },
          ],
        },
      };

      const result = Blog.changelogToText(changelog);

      expect(result).toContain('Swapped:\nCard 1 -> Card 2\nCard 3 -> Card 4\n');
      expect(result).toContain('Edited:\nCard 5\nCard 6\n');
    });

    it('handles multiple boards', () => {
      const changelog = {
        mainboard: {
          adds: [cardAdd1],
        },
        sideboard: {
          removes: [{ index: 22, oldCard: { cardID: '2' } }],
        },
      };

      const result = Blog.changelogToText(changelog);

      expect(result).toContain('Mainboard:\nAdded:\nCard 1\n');
      expect(result).toContain('Sideboard:\nRemoved:\nCard 2\n');
    });

    it('skips empty boards', () => {
      const changelog = {
        mainboard: {
          adds: [cardAdd1],
        },
        sideboard: undefined,
      };

      const result = Blog.changelogToText(changelog);

      expect(result).toContain('Mainboard:');
      expect(result).not.toContain('Sideboard:');
    });
  });
});
