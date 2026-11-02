import { UserRoles } from '@utils/datatypes/User';
import { sanitizeChangelog } from 'dynamo/dao/ChangelogDynamoDao';
import { blogDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

// Strip card details from every blog's changelog — the client rehydrates via
// utils/cardDetailsCache.
const stripBlogsDetails = (blogs: any[]): any[] => {
  for (const blog of blogs) {
    if (blog?.Changelog) sanitizeChangelog(blog.Changelog);
  }
  return blogs;
};

export const blogHandler = async (req: Request, res: Response) => {
  const blogs = await blogDao.getByCube('DEVBLOG', 10);

  return render(
    req,
    res,
    'DevBlog',
    {
      blogs: stripBlogsDetails(blogs.items),
      lastKey: blogs.lastKey,
    },
    { title: 'Developer Blog' },
  );
};

export const getMoreBlogsHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;
  const blogs = await blogDao.getByCube('DEVBLOG', 10, lastKey);

  return res.status(200).send({
    success: 'true',
    blogs: stripBlogsDetails(blogs.items),
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

    // No fan-out: dev blog posts are site-wide announcements, delivered to every user by
    // the dashboard feed merge rather than written into individual feeds.
    await blogDao.createBlog(blogpost);

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
