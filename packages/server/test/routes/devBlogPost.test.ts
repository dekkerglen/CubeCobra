jest.mock('../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../src/dynamo/daos'),
  blogDao: { createBlog: jest.fn() },
  feedDao: { batchPutUnhydrated: jest.fn() },
  userDao: { getAllFollowers: jest.fn() },
}));

import { UserRoles } from '@utils/datatypes/User';

import { blogDao, feedDao, userDao } from '../../src/dynamo/daos';
import { blogPostHandler } from '../../src/router/routes/dev';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

describe('publishing a dev blog post', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (blogDao.createBlog as jest.Mock).mockResolvedValue('blog-1');
    (userDao.getAllFollowers as jest.Mock).mockResolvedValue(['follower-1']);
  });

  const publish = () =>
    call(blogPostHandler as any)
      .as(createUser({ id: 'admin-1', roles: [UserRoles.ADMIN] }))
      .withBody({ title: 'Release notes', body: 'Hello' })
      .send();

  it('writes no feed rows when publishing a dev blog post', async () => {
    const res = await publish();

    expect(res.status).toBe(200);
    expect(blogDao.createBlog).toHaveBeenCalledWith(
      expect.objectContaining({ cube: 'DEVBLOG', owner: 'admin-1', title: 'Release notes' }),
    );
    // Announcements reach every user through the dashboard feed merge, so a fan-out here
    // would only duplicate them for the author's followers.
    expect(feedDao.batchPutUnhydrated).not.toHaveBeenCalled();
    expect(userDao.getAllFollowers).not.toHaveBeenCalled();
  });

  it('reports failure when the post cannot be created', async () => {
    (blogDao.createBlog as jest.Mock).mockRejectedValue(new Error('dynamo down'));

    const res = await publish();

    expect(res.status).toBe(500);
    expect(res.body.success).toBe('false');
  });
});
