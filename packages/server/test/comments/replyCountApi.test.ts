import Comment from '@utils/datatypes/Comment';

jest.mock('../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../src/dynamo/daos'),
  commentDao: { queryByParent: jest.fn(), countRepliesByParent: jest.fn() },
  blogDao: { getById: jest.fn() },
  cubeDao: { getById: jest.fn() },
}));

import { blogDao, commentDao, cubeDao } from '../../src/dynamo/daos';
import { getCommentsHandler } from '../../src/router/routes/comment';
import { call } from '../test-utils/transport';

const comment = (id: string, type: string = 'blog'): Comment =>
  ({ id, type, parent: 'parent-1', body: `body ${id}`, date: 1700000000000 }) as Comment;

const fetchComments = () =>
  call(getCommentsHandler as any)
    .withBody({ parent: 'parent-1' })
    .send();

describe('getcomments reply counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A blog post on no cube, so every comment is visible and the count path is what is tested.
    (blogDao.getById as jest.Mock).mockResolvedValue({ id: 'parent-1', cube: 'DEVBLOG' });
    (commentDao.countRepliesByParent as jest.Mock).mockResolvedValue(0);
  });

  it('returns a reply count for each visible comment', async () => {
    (commentDao.queryByParent as jest.Mock).mockResolvedValue({ items: [comment('c-1'), comment('c-2')] });
    (commentDao.countRepliesByParent as jest.Mock).mockImplementation(async (id: string) => (id === 'c-1' ? 4 : 0));

    const res = await fetchComments();

    expect(res.status).toBe(200);
    expect(res.body.comments.map((c: Comment) => [c.id, c.replyCount])).toEqual([
      ['c-1', 4],
      ['c-2', 0],
    ]);
  });

  it('returns zero rather than omitting the field for a comment with no replies', async () => {
    (commentDao.queryByParent as jest.Mock).mockResolvedValue({ items: [comment('c-1')] });

    const res = await fetchComments();

    expect(res.body.comments[0]).toHaveProperty('replyCount', 0);
  });

  it('counts only the comments it is going to return', async () => {
    // 'blog' resolves to a cube the viewer cannot see, so that comment is dropped before the
    // response; counting its replies would be wasted work. 'card' is not cube-scoped, so it
    // survives.
    (commentDao.queryByParent as jest.Mock).mockResolvedValue({
      items: [comment('c-1', 'blog'), comment('c-2', 'card')],
    });
    (blogDao.getById as jest.Mock).mockResolvedValue({ id: 'parent-1', cube: 'cube-1' });
    (cubeDao.getById as jest.Mock).mockResolvedValue({ id: 'cube-1', owner: { id: 'someone-else' }, visibility: 'pr' });

    const res = await fetchComments();

    expect(res.body.comments.map((c: Comment) => c.id)).toEqual(['c-2']);
    expect((commentDao.countRepliesByParent as jest.Mock).mock.calls.map(([id]) => id)).toEqual(['c-2']);
  });

  it('issues the counts concurrently rather than one after another', async () => {
    (commentDao.queryByParent as jest.Mock).mockResolvedValue({
      items: [comment('c-1'), comment('c-2'), comment('c-3')],
    });

    let inFlight = 0;
    let maxInFlight = 0;
    (commentDao.countRepliesByParent as jest.Mock).mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return 1;
    });

    await fetchComments();

    expect(maxInFlight).toBe(3);
  });

  it('still returns the thread when counting replies fails', async () => {
    // Promise.all over N counts multiplies the failure surface: before this endpoint counted
    // anything, no per-comment query could take the whole thread down. A count is a display
    // nicety; the comments are the content.
    (commentDao.queryByParent as jest.Mock).mockResolvedValue({ items: [comment('c-1'), comment('c-2')] });
    (commentDao.countRepliesByParent as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'c-1') throw new Error('throttled');
      return 3;
    });

    const res = await fetchComments();

    expect(res.status).toBe(200);
    expect(res.body.comments.map((c: Comment) => c.id)).toEqual(['c-1', 'c-2']);
    expect(res.body.comments[0].replyCount).toBeUndefined();
    expect(res.body.comments[1].replyCount).toBe(3);
  });
});
