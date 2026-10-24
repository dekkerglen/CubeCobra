import { NotificationStatus } from '@utils/datatypes/Notification';

jest.mock('../../src/dynamo/daos', () => ({
  userDao: {
    getById: jest.fn(),
    getByUsername: jest.fn(),
    getFollow: jest.fn(),
  },
  cubeDao: {
    batchGet: jest.fn(),
  },
  draftDao: {
    queryByOwnerUnhydrated: jest.fn(),
    queryByOwner: jest.fn(),
  },
  notificationDao: {
    getById: jest.fn(),
    update: jest.fn(),
  },
  packageDao: {
    countByVoter: jest.fn(),
  },
  patronDao: {
    getById: jest.fn(),
  },
}));
jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));

import { cubeDao, draftDao, notificationDao, userDao } from '../../src/dynamo/daos';
import { handler as getByUsernameHandler } from '../../src/router/routes/api/user/getByUsername';
import { handler as decksHandler } from '../../src/router/routes/user/decks';
import { handler as getMoreDecksHandler } from '../../src/router/routes/user/getmoredecks';
import { handler as notificationHandler } from '../../src/router/routes/user/notification';
import { redirect, render } from '../../src/serverutils/render';
import { createCube, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

const owner = createUser({ id: 'owner-1', username: 'owner' });
const viewer = createUser({ id: 'viewer-1', username: 'viewer' });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /user/notification/:id', () => {
  const notification = (overrides: Record<string, any> = {}) => ({
    id: 'n-1',
    to: viewer.id,
    status: NotificationStatus.UNREAD,
    url: '/cube/list/abc',
    ...overrides,
  });

  it("refuses someone else's notification without marking it read", async () => {
    (notificationDao.getById as jest.Mock).mockResolvedValue(notification({ to: 'someone-else' }));

    await call(notificationHandler).as(viewer).withFlash(jest.fn()).withParams({ id: 'n-1' }).send();

    expect(notificationDao.update).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it('marks your own notification read and follows its link', async () => {
    (notificationDao.getById as jest.Mock).mockResolvedValue(notification());

    await call(notificationHandler).as(viewer).withFlash(jest.fn()).withParams({ id: 'n-1' }).send();

    expect(notificationDao.update).toHaveBeenCalledWith(expect.objectContaining({ status: NotificationStatus.READ }));
    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/list/abc');
  });

  it('never follows a link off the site', async () => {
    (notificationDao.getById as jest.Mock).mockResolvedValue(notification({ url: '//evil.example/phish' }));

    await call(notificationHandler).as(viewer).withFlash(jest.fn()).withParams({ id: 'n-1' }).send();

    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/');
  });
});

describe('deck lists hide drafts of cubes the viewer cannot see', () => {
  const publicCube = createCube({ id: 'public-cube', visibility: 'pu', owner });
  const privateCube = createCube({ id: 'private-cube', visibility: 'pr', owner });
  const decks = [
    { id: 'deck-public', cube: 'public-cube' },
    { id: 'deck-private', cube: 'private-cube' },
    { id: 'deck-deleted', cube: 'deleted-cube' },
  ];

  beforeEach(() => {
    (userDao.getById as jest.Mock).mockResolvedValue(owner);
    (cubeDao.batchGet as jest.Mock).mockResolvedValue([publicCube, privateCube]);
    (draftDao.queryByOwnerUnhydrated as jest.Mock).mockResolvedValue({ items: decks, lastKey: undefined });
    (draftDao.queryByOwner as jest.Mock).mockResolvedValue({ items: decks, lastKey: undefined });
  });

  const renderedDeckIds = () => (render as jest.Mock).mock.calls[0][3].decks.map((deck: any) => deck.id);

  it('shows an anonymous visitor only drafts of public cubes', async () => {
    await call(decksHandler).withFlash(jest.fn()).withParams({ userid: 'owner-1' }).send();

    expect(cubeDao.batchGet).toHaveBeenCalledWith(['public-cube', 'private-cube', 'deleted-cube']);
    expect(renderedDeckIds()).toEqual(['deck-public']);
  });

  it('shows another user only drafts of cubes they can see', async () => {
    await call(decksHandler).as(viewer).withFlash(jest.fn()).withParams({ userid: 'owner-1' }).send();

    expect(renderedDeckIds()).toEqual(['deck-public']);
  });

  it('shows the cube owner drafts of their private cube', async () => {
    await call(decksHandler).as(owner).withFlash(jest.fn()).withParams({ userid: 'owner-1' }).send();

    expect(renderedDeckIds()).toEqual(['deck-public', 'deck-private']);
  });

  it('filters the paged endpoint the same way', async () => {
    const { body } = await call(getMoreDecksHandler).as(viewer).withBody({}).send();

    expect(body.decks.map((deck: any) => deck.id)).toEqual(['deck-public']);
  });
});

describe('GET /api/user/getByUsername/:id', () => {
  it('returns only the public projection of the user', async () => {
    (userDao.getByUsername as jest.Mock).mockResolvedValue({
      ...owner,
      email: 'owner@example.com',
      token: 'secret-token',
      emailVerified: false,
      roles: ['Admin'],
      patron: 'patron@example.com',
      consentToHashedEmail: true,
      dateCreated: 1,
    });

    const { status, body } = await call(getByUsernameHandler).withParams({ id: 'owner' }).send();

    expect(status).toBe(200);
    expect(body).toEqual({ user: { id: 'owner-1', username: 'owner' } });
  });

  it('404s an unknown username', async () => {
    (userDao.getByUsername as jest.Mock).mockResolvedValue(null);

    const { status } = await call(getByUsernameHandler).withParams({ id: 'nobody' }).send();

    expect(status).toBe(404);
  });
});
