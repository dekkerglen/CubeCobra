import { ContentStatus } from '@utils/datatypes/Content';
import { UserRoles } from '@utils/datatypes/User';

import {
  editPodcastHandler,
  episodeHandler,
  podcastHandler,
  submitPodcastHandler,
  videoHandler,
} from '../../src/router/routes/content';
import { createEpisode, createPodcast, createUser, createVideo } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  redirect: jest.fn(),
  render: jest.fn(),
}));

jest.mock('serverutils/rss', () => ({
  ...jest.requireActual('serverutils/rss'),
  getFeedData: jest.fn(),
}));

jest.mock('../../src/dynamo/daos', () => ({
  podcastDao: { getById: jest.fn(), update: jest.fn() },
  episodeDao: { getById: jest.fn(), queryByPodcast: jest.fn().mockResolvedValue({ items: [] }) },
  videoDao: { getById: jest.fn() },
  articleDao: { getById: jest.fn() },
  noticeDao: { getByStatus: jest.fn() },
}));

import { episodeDao, podcastDao, videoDao } from '../../src/dynamo/daos';
import { redirect, render } from '../../src/serverutils/render';
import { getFeedData } from '../../src/serverutils/rss';

const owner = createUser();
const stranger = createUser();
const admin = createUser({ roles: [UserRoles.ADMIN] });

beforeEach(() => {
  jest.clearAllMocks();
});

describe.each([
  ['podcast', podcastHandler, podcastDao, createPodcast],
  ['episode', episodeHandler, episodeDao, createEpisode],
  ['video', videoHandler, videoDao, createVideo],
])('GET /content/%s/:id', (_name, handler, dao, create) => {
  const view = (status: ContentStatus, user?: ReturnType<typeof createUser>) => {
    (dao.getById as jest.Mock).mockResolvedValue((create as any)({ owner, status }));
    const builder = call(handler).withFlash(jest.fn()).withParams({ id: 'content-id' });
    return (user ? builder.as(user) : builder).send();
  };

  it.each([ContentStatus.DRAFT, ContentStatus.IN_REVIEW])('hides %s content from other users', async (status) => {
    await view(status, stranger);
    await view(status);

    expect(render).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/content/browse');
  });

  it('shows unpublished content to its owner and to admins', async () => {
    await view(ContentStatus.IN_REVIEW, owner);
    await view(ContentStatus.IN_REVIEW, admin);

    expect(render).toHaveBeenCalledTimes(2);
  });

  it('shows published content to everyone', async () => {
    await view(ContentStatus.PUBLISHED);

    expect(render).toHaveBeenCalledTimes(1);
  });
});

describe.each([
  ['edit', editPodcastHandler],
  ['submit', submitPodcastHandler],
])('POST /content/%spodcast', (_name, handler) => {
  const send = (rss: unknown) => {
    const flash = jest.fn();
    const podcast = createPodcast({ owner, status: ContentStatus.DRAFT, description: '' });
    (podcastDao.getById as jest.Mock).mockResolvedValue(podcast);
    return call(handler)
      .as(owner)
      .withFlash(flash)
      .withBody({ podcastid: podcast.id, rss })
      .send()
      .then(() => ({ flash, podcast }));
  };

  it('stores a sanitized feed description', async () => {
    (getFeedData as jest.Mock).mockResolvedValue({
      title: 'Cast',
      description:
        '<p>Weekly <b>cube</b> talk<img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:x">x</a><a href="https://example.com">site</a></p>',
      url: 'https://example.com',
      image: 'https://example.com/a.png',
    });

    const { podcast } = await send('https://example.com/feed.xml');

    expect(podcastDao.update).toHaveBeenCalledTimes(1);
    expect(podcast.description).toBe('<p>Weekly <b>cube</b> talk<a>x</a><a href="https://example.com">site</a></p>');
  });
});
