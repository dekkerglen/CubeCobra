import { UserRoles } from '@utils/datatypes/User';

jest.mock('../../src/dynamo/daos', () => ({
  noticeDao: { getById: jest.fn(), update: jest.fn() },
  cubeDao: { queryByOwner: jest.fn(), deleteById: jest.fn() },
  blogDao: { queryByOwner: jest.fn(), delete: jest.fn() },
  draftDao: { queryByOwner: jest.fn(), deleteById: jest.fn() },
  commentDao: { queryByOwner: jest.fn(), update: jest.fn() },
  userDao: { getById: jest.fn(), update: jest.fn() },
  patronDao: {},
}));
jest.mock('serverutils/render', () => ({
  redirect: jest.fn(),
}));

import { blogDao, commentDao, cubeDao, draftDao, noticeDao, userDao } from '../../src/dynamo/daos';
import { banuserHandler } from '../../src/router/routes/admin/banuser';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

describe('banuserHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (noticeDao.getById as jest.Mock).mockResolvedValue({ id: 'notice-1', subject: 'bad-user' });
    (cubeDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [] });
    (draftDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [] });
    (commentDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [] });
    (userDao.getById as jest.Mock).mockResolvedValue(createUser({ id: 'bad-user' }));
  });

  it('deletes every page of blog posts, including the first', async () => {
    (blogDao.queryByOwner as jest.Mock)
      .mockResolvedValueOnce({ items: [{ id: 'b1' }, { id: 'b2' }], lastKey: { k: 1 } })
      .mockResolvedValueOnce({ items: [{ id: 'b3' }], lastKey: undefined });
    const flash = jest.fn();

    await call(banuserHandler).withFlash(flash).withParams({ id: 'notice-1' }).send();

    expect((blogDao.delete as jest.Mock).mock.calls.map(([blog]) => blog.id)).toEqual(['b1', 'b2', 'b3']);
    expect(flash).toHaveBeenCalledWith('success', expect.stringContaining('3 blog posts'));
    expect(userDao.update).toHaveBeenCalledWith(expect.objectContaining({ roles: [UserRoles.BANNED] }));
  });

  it('deletes a single page of blog posts', async () => {
    (blogDao.queryByOwner as jest.Mock).mockResolvedValueOnce({ items: [{ id: 'b1' }], lastKey: undefined });

    await call(banuserHandler).withFlash(jest.fn()).withParams({ id: 'notice-1' }).send();

    expect(blogDao.delete).toHaveBeenCalledWith({ id: 'b1' });
  });
});
