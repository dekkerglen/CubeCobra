import User from '@utils/datatypes/User';

import Draft from '../../src/dynamo/models/draft';
import Package from '../../src/dynamo/models/package';
import { getReplyContext } from '../../src/router/routes/comment';

// Mock the DAOs from dynamo/daos
jest.mock('../../src/dynamo/daos', () => ({
  commentDao: {
    getById: jest.fn(),
  },
  blogDao: {
    getById: jest.fn(),
  },
  articleDao: {
    getById: jest.fn(),
  },
  videoDao: {
    getById: jest.fn(),
  },
  podcastDao: {
    getById: jest.fn(),
  },
  episodeDao: {
    getById: jest.fn(),
  },
}));

// Import the mocked DAOs
import { articleDao, blogDao, commentDao, episodeDao, podcastDao, videoDao } from '../../src/dynamo/daos';
jest.mock('../../src/dynamo/models/draft');
jest.mock('../../src/dynamo/models/package');

describe('getReplyContext', () => {
  const mockUser: User = { id: 'user123', username: 'Test User' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the owner of a comment', async () => {
    (commentDao.getById as jest.Mock).mockResolvedValue({ id: '123', owner: mockUser });

    const owner = await getReplyContext.comment('123');

    expect(commentDao.getById).toHaveBeenCalledWith('123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of a blog', async () => {
    (blogDao.getById as jest.Mock).mockResolvedValue({ id: 'blog123', owner: mockUser });

    const owner = await getReplyContext.blog('blog123');

    expect(blogDao.getById).toHaveBeenCalledWith('blog123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of a deck', async () => {
    (Draft.getById as jest.Mock).mockResolvedValue({ id: 'deck123', owner: mockUser });

    const owner = await getReplyContext.deck('deck123');

    expect(Draft.getById).toHaveBeenCalledWith('deck123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of an article', async () => {
    (articleDao.getById as jest.Mock).mockResolvedValue({ id: 'article123', owner: mockUser });

    const owner = await getReplyContext.article('article123');

    expect(articleDao.getById).toHaveBeenCalledWith('article123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of a podcast', async () => {
    (podcastDao.getById as jest.Mock).mockResolvedValue({ id: 'podcast123', owner: mockUser });

    const owner = await getReplyContext.podcast('podcast123');

    expect(podcastDao.getById).toHaveBeenCalledWith('podcast123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of a video', async () => {
    (videoDao.getById as jest.Mock).mockResolvedValue({ id: 'video123', owner: mockUser });

    const owner = await getReplyContext.video('video123');

    expect(videoDao.getById).toHaveBeenCalledWith('video123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of an episode', async () => {
    (episodeDao.getById as jest.Mock).mockResolvedValue({ id: 'episode123', owner: mockUser });

    const owner = await getReplyContext.episode('episode123');

    expect(episodeDao.getById).toHaveBeenCalledWith('episode123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of a package', async () => {
    (Package.getById as jest.Mock).mockResolvedValue({ id: 'package123', owner: mockUser });

    const owner = await getReplyContext.package('package123');

    expect(Package.getById).toHaveBeenCalledWith('package123');
    expect(owner).toEqual(mockUser);
  });

  it('should return undefined if no owner exists for a comment', async () => {
    (commentDao.getById as jest.Mock).mockResolvedValue({ id: '123', owner: undefined });

    const owner = await getReplyContext.comment('123');

    expect(commentDao.getById).toHaveBeenCalledWith('123');
    expect(owner).toBeUndefined();
  });

  it('should return undefined if the resource does not exist', async () => {
    (blogDao.getById as jest.Mock).mockResolvedValue(null);

    const owner = await getReplyContext.blog('nonexistent-id');

    expect(blogDao.getById).toHaveBeenCalledWith('nonexistent-id');
    expect(owner).toBeUndefined();
  });
});
