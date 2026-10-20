import bcrypt from 'bcryptjs';

jest.mock('../../src/dynamo/daos', () => ({
  blogDao: { queryByOwner: jest.fn(), delete: jest.fn() },
  commentDao: { queryByOwner: jest.fn(), put: jest.fn(), update: jest.fn() },
  cubeDao: { queryByOwner: jest.fn() },
  draftDao: { queryByOwner: jest.fn(), deleteById: jest.fn() },
  userDao: { getByIdWithSensitiveData: jest.fn(), deleteById: jest.fn() },
}));

jest.mock('serverutils/render', () => ({
  redirect: jest.fn(),
}));

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

import { blogDao, commentDao, cubeDao, draftDao, userDao } from '../../src/dynamo/daos';
import { handler } from '../../src/router/routes/user/deleteaccount';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

describe('delete account handler', () => {
  const flash = jest.fn();
  const user = createUser({ id: 'user-1' });

  beforeEach(() => {
    jest.clearAllMocks();
    (userDao.getByIdWithSensitiveData as jest.Mock).mockResolvedValue({ ...user, passwordHash: 'hash' });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (cubeDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [] });
    (blogDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [] });
    (draftDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [] });
  });

  it('wipes existing comments with update and deletes the user', async () => {
    (commentDao.queryByOwner as jest.Mock).mockResolvedValue({
      items: [
        { id: 'c1', body: 'first', owner: user },
        { id: 'c2', body: 'second', owner: user },
      ],
    });

    await call(handler)
      .as(user)
      .withFlash(flash)
      .withRequest({ validated: true, body: { password: 'pw' }, logout: jest.fn() } as any)
      .send();

    expect(commentDao.put).not.toHaveBeenCalled();
    expect(commentDao.update).toHaveBeenCalledTimes(2);
    expect(commentDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', body: '[deleted]', owner: undefined }),
    );
    expect(userDao.deleteById).toHaveBeenCalledWith('user-1');
    expect(flash).toHaveBeenCalledWith('success', expect.stringContaining('2 comments'));
  });
});
