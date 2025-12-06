import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { commentDao } from 'dynamo/daos';
import Blog from 'dynamo/models/blog';
import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import Notice from 'dynamo/models/notice';
import User from 'dynamo/models/user';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const banuserHandler = async (req: Request, res: Response) => {
  try {
    const notice = await Notice.getById(req.params.id!);
    const userToBan = notice.subject!;

    const aggregates = {
      commentsWiped: 0,
      cubesDeleted: 0,
      blogPostsDeleted: 0,
      draftsDeleted: 0,
      failed: [],
    };

    // delete all cubes
    const response = await Cube.getByOwner(userToBan);

    aggregates.cubesDeleted += response.items.length;
    for (const cube of response.items) {
      await Cube.deleteById(cube.id);
    }

    // delete all blog posts
    const blogResponse = await Blog.getByOwner(userToBan!, 100);

    let lastKey = blogResponse.lastKey;
    let blogIds = blogResponse.items.map((blog) => blog.id);

    while (lastKey) {
      const nextResponse = await Blog.getByOwner(userToBan!, 100, lastKey);
      lastKey = nextResponse.lastKey;
      blogIds = blogIds.concat(nextResponse.items.map((blog) => blog.id));
    }

    aggregates.blogPostsDeleted += blogIds.length;
    for (const blogId of blogIds) {
      await Blog.delete(blogId);
    }

    // delete all drafts
    const draftResponse = await Draft.getByOwner(userToBan!);

    lastKey = draftResponse.lastEvaluatedKey;
    let draftIds = draftResponse.items.map((draft: any) => draft.id);

    while (lastKey) {
      const nextResponse = await Draft.getByOwner(userToBan!, lastKey, 100);
      lastKey = nextResponse.lastEvaluatedKey;
      draftIds = draftIds.concat(nextResponse.items.map((draft: any) => draft.id));
    }

    aggregates.draftsDeleted += draftIds.length;
    for (const draftId of draftIds) {
      await Draft.delete(draftId);
    }

    const commentResponse = await commentDao.queryByOwner(userToBan!);
    let lastkey = commentResponse.lastKey;
    let comments = commentResponse.items || [];

    while (lastkey) {
      const nextResponse = await commentDao.queryByOwner(userToBan!, lastkey);
      lastkey = nextResponse.lastKey;
      comments = comments.concat(nextResponse.items || []);
    }

    // delete all comments
    aggregates.commentsWiped += comments.length;

    for (const comment of comments) {
      comment.owner = undefined;
      comment.body = '[deleted]';

      await commentDao.put(comment);
    }

    // ban user
    const user = await User.getById(userToBan!);

    if (user) {
      user.roles = [UserRoles.BANNED];
      user.about = '[deleted]';

      await User.put(user);
    }

    notice.status = NoticeStatus.PROCESSED;
    await Notice.put(notice);

    req.flash(
      'success',
      `User ${userToBan} has been banned. ${aggregates.cubesDeleted} cubes, ${aggregates.blogPostsDeleted} blog posts, ${aggregates.draftsDeleted} drafts, and ${aggregates.commentsWiped} comments were deleted.`,
    );
    return redirect(req, res, '/admin/notices');
  } catch (err) {
    const error = err as Error;
    req.flash('danger', error.message);
    return redirect(req, res, '/admin/notices');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), banuserHandler],
  },
];
