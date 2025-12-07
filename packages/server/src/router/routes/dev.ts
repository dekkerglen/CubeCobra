import { FeedTypes } from '@utils/datatypes/Feed';
import { UserRoles } from '@utils/datatypes/User';
import { blogDao } from 'dynamo/daos';
import Feed from 'dynamo/models/feed';
import { csrfProtection, ensureRole } from 'router/middleware';
import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

export const blogHandler = async (req: Request, res: Response) => {
  const blogs = await blogDao.getByCube('DEVBLOG', 10);

  return render(req, res, 'DevBlog', {
    blogs: blogs.items,
    lastKey: blogs.lastKey,
  });
};

export const getMoreBlogsHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;
  const blogs = await blogDao.getByCube('DEVBLOG', 10, lastKey);

  return res.status(200).send({
    success: 'true',
    blogs: blogs.items,
    lastKey: blogs.lastKey,
  });
};

export const blogPostHandler = async (req: Request, res: Response) => {
  try {
    const blogpost = {
      body: req.body.body,
      owner: req.user!.id,
      cube: 'DEVBLOG',
      title: req.body.title,
    };

    const id = await blogDao.createBlog(blogpost);

    const feedItems = req.user!.following?.map((user) => ({
      id,
      to: user,
      date: Date.now().valueOf(),
      type: FeedTypes.BLOG,
    }));

    if (feedItems && feedItems.length > 0) {
      await Feed.batchPut(feedItems);
    }

    return res.status(200).send({
      success: 'true',
      blogpost,
    });
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      error: (err as Error).message,
    });
  }
};

export const routes = [
  {
    path: '/blog',
    method: 'get',
    handler: [csrfProtection, blogHandler],
  },
  {
    path: '/getmoreblogs',
    method: 'post',
    handler: [csrfProtection, getMoreBlogsHandler],
  },
  {
    path: '/blogpost',
    method: 'post',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), blogPostHandler],
  },
];
