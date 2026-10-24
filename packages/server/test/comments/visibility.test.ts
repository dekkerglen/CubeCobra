import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';

import {
  addCommentHandler,
  canAccessCommentParent,
  getCommentsHandler,
  getHandler,
} from '../../src/router/routes/comment';
import { createCube, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));

jest.mock('serverutils/util', () => ({
  ...jest.requireActual('serverutils/util'),
  addNotification: jest.fn(),
}));

jest.mock('../../src/dynamo/daos', () => ({
  commentDao: { getById: jest.fn(), queryByParent: jest.fn(), createComment: jest.fn() },
  cubeDao: { getById: jest.fn() },
  blogDao: { getById: jest.fn() },
  draftDao: { getById: jest.fn() },
  recordDao: { getById: jest.fn() },
  p1p1PackDao: { getMetadataById: jest.fn() },
  articleDao: { getById: jest.fn() },
  userDao: { getByUsername: jest.fn() },
}));

import { blogDao, commentDao, cubeDao, draftDao, p1p1PackDao, recordDao } from '../../src/dynamo/daos';
import { render } from '../../src/serverutils/render';

const owner = createUser();
const stranger = createUser();
const privateCube = createCube({ id: 'private-cube', owner, visibility: CUBE_VISIBILITY.PRIVATE });
const publicCube = createCube({ id: 'public-cube', owner, visibility: CUBE_VISIBILITY.PUBLIC });

beforeEach(() => {
  jest.clearAllMocks();
  (cubeDao.getById as jest.Mock).mockImplementation(async (id: string) =>
    [privateCube, publicCube].find((cube) => cube.id === id),
  );
  (blogDao.getById as jest.Mock).mockImplementation(async (id: string) => {
    if (id === 'private-blog') return { id, cube: privateCube.id };
    if (id === 'public-blog') return { id, cube: publicCube.id };
    if (id === 'dev-blog') return { id, cube: 'DEVBLOG' };
    return undefined;
  });
  (draftDao.getById as jest.Mock).mockImplementation(async (id: string) =>
    id === 'private-deck' ? { id, cube: privateCube.id } : undefined,
  );
  (recordDao.getById as jest.Mock).mockImplementation(async (id: string) =>
    id === 'private-record' ? { id, cube: privateCube.id } : undefined,
  );
  (p1p1PackDao.getMetadataById as jest.Mock).mockImplementation(async (id: string) =>
    id === 'private-pack' ? { id, cubeId: privateCube.id } : undefined,
  );
  (commentDao.getById as jest.Mock).mockImplementation(async (id: string) => {
    if (id === 'reply-on-private-blog') return { id, type: 'blog', parent: 'private-blog' };
    if (id === 'reply-on-reply') return { id, type: 'comment', parent: 'reply-on-private-blog' };
    if (id === 'loop') return { id, type: 'comment', parent: 'loop' };
    return undefined;
  });
});

describe('canAccessCommentParent', () => {
  it.each([
    ['blog', 'private-blog'],
    ['deck', 'private-deck'],
    ['record', 'private-record'],
    ['p1p1', 'private-pack'],
    ['comment', 'reply-on-private-blog'],
    ['comment', 'reply-on-reply'],
  ])('hides a %s on a private cube from strangers', async (type, parent) => {
    expect(await canAccessCommentParent(type, parent, stranger)).toBe(false);
    expect(await canAccessCommentParent(type, parent, owner)).toBe(true);
  });

  it('allows public and non-cube parents', async () => {
    expect(await canAccessCommentParent('blog', 'public-blog', stranger)).toBe(true);
    expect(await canAccessCommentParent('blog', 'dev-blog', stranger)).toBe(true);
    expect(await canAccessCommentParent('article', 'anything', stranger)).toBe(true);
    expect(await canAccessCommentParent('card', 'anything', undefined)).toBe(true);
  });

  it('allows reading orphaned threads but not writing to them', async () => {
    expect(await canAccessCommentParent('deck', 'deleted-deck', stranger)).toBe(true);
    expect(await canAccessCommentParent('deck', 'deleted-deck', stranger, true)).toBe(false);
  });

  it('stops walking a reply chain that never ends', async () => {
    expect(await canAccessCommentParent('comment', 'loop', owner)).toBe(false);
  });
});

describe('POST /comment/getcomments', () => {
  it('filters out comments whose parent is not viewable', async () => {
    (commentDao.queryByParent as jest.Mock).mockResolvedValue({
      items: [
        { id: '1', type: 'blog', parent: 'private-blog', body: 'secret' },
        // A comment filed under a different type can't unlock the thread.
        { id: '2', type: 'article', parent: 'private-blog', body: 'planted' },
      ],
      lastKey: undefined,
    });

    const asStranger = await call(getCommentsHandler).as(stranger).withBody({ parent: 'private-blog' }).send();
    expect(asStranger.body.comments.map((c: any) => c.id)).toEqual(['2']);

    const asOwner = await call(getCommentsHandler).as(owner).withBody({ parent: 'private-blog' }).send();
    expect(asOwner.body.comments.map((c: any) => c.id)).toEqual(['1', '2']);
  });
});

describe('GET /comment/:id', () => {
  it("doesn't render a comment on a private cube's blog post", async () => {
    await call(getHandler).as(stranger).withFlash(jest.fn()).withParams({ id: 'reply-on-private-blog' }).send();

    expect(render).not.toHaveBeenCalled();
  });
});

describe('POST /comment/addcomment', () => {
  const add = (user: ReturnType<typeof createUser>, type: string, parent: string) =>
    call(addCommentHandler).as(user).withBody({ body: 'hello', parent, type }).send();

  it('refuses comments on a private deck', async () => {
    const res = await add(stranger, 'deck', 'private-deck');

    expect(res.status).toBe(404);
    expect(commentDao.createComment).not.toHaveBeenCalled();
  });

  it('refuses comments on a cube-scoped parent that does not exist', async () => {
    const res = await add(stranger, 'deck', 'private-blog');

    expect(res.status).toBe(404);
    expect(commentDao.createComment).not.toHaveBeenCalled();
  });

  it('lets the owner comment on their private deck', async () => {
    (commentDao.createComment as jest.Mock).mockResolvedValue({ id: 'new' });

    const res = await add(owner, 'deck', 'private-deck');

    expect(res.status).toBe(200);
    expect(commentDao.createComment).toHaveBeenCalled();
  });
});
