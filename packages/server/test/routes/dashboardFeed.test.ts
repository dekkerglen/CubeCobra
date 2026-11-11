jest.mock('../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../src/dynamo/daos'),
  blogDao: { queryByCube: jest.fn() },
  feedDao: { getByTo: jest.fn() },
}));

import BlogPost from '@utils/datatypes/BlogPost';
import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import { FeedTypes } from '@utils/datatypes/Feed';

import { blogDao, feedDao } from '../../src/dynamo/daos';
import { routes } from '../../src/router/routes/dashboard';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

const feedHandler = routes.find((route) => route.path === '/getmorefeeditems')!.handler.at(-1)!;

const post = (id: string, date: number, overrides: Partial<BlogPost> = {}): BlogPost =>
  ({
    id,
    date,
    cube: 'cube-1',
    cubeName: 'Cube',
    cubeVisibility: CUBE_VISIBILITY.PUBLIC,
    body: '',
    owner: { id: 'owner-1', username: 'owner' },
    ...overrides,
  }) as unknown as BlogPost;

const devPost = (id: string, date: number): BlogPost => post(id, date, { cube: 'DEVBLOG', cubeName: 'Unknown' });

const personalFeed = (items: BlogPost[], lastKey?: Record<string, any>) => ({
  items: items.map((document) => ({ type: FeedTypes.BLOG, document })),
  lastKey,
});

const streamCursor = (date: number, ids: string[] = []) => ({ date, ids, done: false });

const fetchFeed = (body: any = {}) =>
  call(feedHandler as any)
    .as(createUser({ id: 'user-1' }))
    .withBody(body)
    .send();

describe('dashboard feed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (feedDao.getByTo as jest.Mock).mockResolvedValue(personalFeed([]));
    (blogDao.queryByCube as jest.Mock).mockResolvedValue({ items: [] });
  });

  it('delivers dev posts to a user with an empty personal feed', async () => {
    (blogDao.queryByCube as jest.Mock).mockResolvedValue({ items: [devPost('dev-1', 500)] });

    const res = await fetchFeed();

    expect(res.status).toBe(200);
    expect(res.body.items.map((i: BlogPost) => i.id)).toEqual(['dev-1']);
  });

  it('reads announcements from the DEVBLOG stream', async () => {
    await fetchFeed();

    expect(blogDao.queryByCube).toHaveBeenCalledWith('DEVBLOG', undefined, 50, undefined);
  });

  it('behaves exactly as before when no dev posts exist', async () => {
    (feedDao.getByTo as jest.Mock).mockResolvedValue(personalFeed([post('p-1', 300), post('p-2', 200)]));

    const res = await fetchFeed();

    expect(res.body.items.map((i: BlogPost) => i.id)).toEqual(['p-1', 'p-2']);
    expect(res.body.lastKey).toBeNull();
  });

  it('shows a dev post once to a follower who has a legacy DEVBLOG feed row', async () => {
    (feedDao.getByTo as jest.Mock).mockResolvedValue(personalFeed([devPost('dev-1', 500), post('p-1', 300)]));
    (blogDao.queryByCube as jest.Mock).mockResolvedValue({ items: [devPost('dev-1', 500)] });

    const res = await fetchFeed();

    expect(res.body.items.map((i: BlogPost) => i.id)).toEqual(['dev-1', 'p-1']);
  });

  it('orders items across both streams by date descending', async () => {
    (feedDao.getByTo as jest.Mock).mockResolvedValue(personalFeed([post('p-400', 400), post('p-100', 100)]));
    (blogDao.queryByCube as jest.Mock).mockResolvedValue({ items: [devPost('dev-300', 300)] });

    const res = await fetchFeed();

    expect(res.body.items.map((i: BlogPost) => i.id)).toEqual(['p-400', 'dev-300', 'p-100']);
  });

  it('reports more remaining when only the announcement stream has more', async () => {
    (feedDao.getByTo as jest.Mock).mockResolvedValue(personalFeed([post('p-1', 300)]));
    (blogDao.queryByCube as jest.Mock).mockResolvedValue({
      items: [devPost('dev-1', 500)],
      lastKey: { PK: 'BLOG#dev-1' },
    });

    const res = await fetchFeed();

    expect(res.body.lastKey).toEqual({
      personal: streamCursor(300, ['p-1']),
      announcements: streamCursor(300, ['p-1']),
    });
  });

  it('passes the cursor date as the upper bound on both streams', async () => {
    const date = 1700000000000;

    await fetchFeed({
      lastKey: { personal: streamCursor(date, ['seen']), announcements: streamCursor(date, ['seen']) },
    });

    expect(feedDao.getByTo).toHaveBeenCalledWith('user-1', undefined, 50, date);
    expect(blogDao.queryByCube).toHaveBeenCalledWith('DEVBLOG', undefined, 50, date);
  });

  it('still hides blog posts from non-public cubes', async () => {
    (feedDao.getByTo as jest.Mock).mockResolvedValue(
      personalFeed([
        post('private-1', 400, { cubeVisibility: CUBE_VISIBILITY.PRIVATE }),
        post('unlisted-1', 300, { cubeVisibility: CUBE_VISIBILITY.UNLISTED }),
        post('public-1', 200),
      ]),
    );

    const res = await fetchFeed();

    expect(res.body.items.map((i: BlogPost) => i.id)).toEqual(['public-1']);
  });

  it('strips card details from changelogs in the response', async () => {
    const withDetails = post('p-1', 300, {
      Changelog: { mainboard: { adds: [{ cardID: 'card-1', details: { name: 'Black Lotus' } } as any] } },
    });
    (feedDao.getByTo as jest.Mock).mockResolvedValue(personalFeed([withDetails]));

    const res = await fetchFeed();

    expect(res.body.items[0].Changelog.mainboard.adds[0]).toEqual({ cardID: 'card-1' });
  });

  it('starts from the first page when lastKey is malformed', async () => {
    (blogDao.queryByCube as jest.Mock).mockResolvedValue({ items: [devPost('dev-1', 500)] });

    const res = await fetchFeed({ lastKey: 'garbage' });

    expect(res.status).toBe(200);
    expect(res.body.items.map((i: BlogPost) => i.id)).toEqual(['dev-1']);
    expect(feedDao.getByTo).toHaveBeenCalledWith('user-1', undefined, 50, undefined);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await call(feedHandler as any)
      .withBody({})
      .send();

    expect(res.status).toBe(401);
  });

  describe('when a whole page is privacy-filtered', () => {
    const privatePage = (count: number) =>
      Array.from({ length: count }, (_, i) =>
        post(`private-${i}`, 1000 - i, { cubeVisibility: CUBE_VISIBILITY.PRIVATE }),
      );

    it('keeps fetching rather than returning an empty page while more remains', async () => {
      // The client renders its "no feed items" dead-end on an empty page and offers no way
      // to advance, so an empty page with a cursor would strand the user short of the
      // announcements this feature exists to deliver.
      (feedDao.getByTo as jest.Mock)
        .mockResolvedValueOnce(personalFeed(privatePage(50), { PK: 'FEED#x' }))
        .mockResolvedValueOnce(personalFeed([post('public-1', 200)]));

      const res = await fetchFeed();

      expect(res.body.items.map((i: BlogPost) => i.id)).toEqual(['public-1']);
      expect(feedDao.getByTo).toHaveBeenCalledTimes(2);
    });

    it('bounds the number of rounds it will fetch', async () => {
      (feedDao.getByTo as jest.Mock).mockResolvedValue(personalFeed(privatePage(50), { PK: 'FEED#x' }));

      const res = await fetchFeed();

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect((feedDao.getByTo as jest.Mock).mock.calls.length).toBeLessThanOrEqual(5);
    });

    it('does not re-fetch when the first page already has items', async () => {
      (feedDao.getByTo as jest.Mock).mockResolvedValue(personalFeed([post('public-1', 200)]));

      await fetchFeed();

      expect(feedDao.getByTo).toHaveBeenCalledTimes(1);
    });
  });
});
