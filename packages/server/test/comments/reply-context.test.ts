import User from '../../src/datatypes/User';
import Blog from '../../src/dynamo/models/blog';
import Comment from '../../src/dynamo/models/comment';
import Content from '../../src/dynamo/models/content';
import Draft from '../../src/dynamo/models/draft';
import Package from '../../src/dynamo/models/package';
import { getReplyContext } from '../../src/router/routes/comment';

jest.mock('../../src/dynamo/models/comment');
jest.mock('../../src/dynamo/models/blog');
jest.mock('../../src/dynamo/models/draft');
jest.mock('../../src/dynamo/models/content');
jest.mock('../../src/dynamo/models/package');

describe('getReplyContext', () => {
  const mockUser: User = { id: 'user123', username: 'Test User' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the owner of a comment', async () => {
    (Comment.getById as jest.Mock).mockResolvedValue({ id: '123', owner: mockUser });

    const owner = await getReplyContext.comment('123');

    expect(Comment.getById).toHaveBeenCalledWith('123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of a blog', async () => {
    (Blog.getById as jest.Mock).mockResolvedValue({ id: 'blog123', owner: mockUser });

    const owner = await getReplyContext.blog('blog123');

    expect(Blog.getById).toHaveBeenCalledWith('blog123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of a deck', async () => {
    (Draft.getById as jest.Mock).mockResolvedValue({ id: 'deck123', owner: mockUser });

    const owner = await getReplyContext.deck('deck123');

    expect(Draft.getById).toHaveBeenCalledWith('deck123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of an article', async () => {
    (Content.getById as jest.Mock).mockResolvedValue({ id: 'article123', owner: mockUser });

    const owner = await getReplyContext.article('article123');

    expect(Content.getById).toHaveBeenCalledWith('article123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of a podcast', async () => {
    (Content.getById as jest.Mock).mockResolvedValue({ id: 'podcast123', owner: mockUser });

    const owner = await getReplyContext.podcast('podcast123');

    expect(Content.getById).toHaveBeenCalledWith('podcast123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of a video', async () => {
    (Content.getById as jest.Mock).mockResolvedValue({ id: 'video123', owner: mockUser });

    const owner = await getReplyContext.video('video123');

    expect(Content.getById).toHaveBeenCalledWith('video123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of an episode', async () => {
    (Content.getById as jest.Mock).mockResolvedValue({ id: 'episode123', owner: mockUser });

    const owner = await getReplyContext.episode('episode123');

    expect(Content.getById).toHaveBeenCalledWith('episode123');
    expect(owner).toEqual(mockUser);
  });

  it('should return the owner of a package', async () => {
    (Package.getById as jest.Mock).mockResolvedValue({ id: 'package123', owner: mockUser });

    const owner = await getReplyContext.package('package123');

    expect(Package.getById).toHaveBeenCalledWith('package123');
    expect(owner).toEqual(mockUser);
  });

  it('should return undefined if no owner exists for a comment', async () => {
    (Comment.getById as jest.Mock).mockResolvedValue({ id: '123', owner: undefined });

    const owner = await getReplyContext.comment('123');

    expect(Comment.getById).toHaveBeenCalledWith('123');
    expect(owner).toBeUndefined();
  });

  it('should return undefined if the resource does not exist', async () => {
    (Blog.getById as jest.Mock).mockResolvedValue(null);

    const owner = await getReplyContext.blog('nonexistent-id');

    expect(Blog.getById).toHaveBeenCalledWith('nonexistent-id');
    expect(owner).toBeUndefined();
  });
});
