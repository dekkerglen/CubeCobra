import Blog from '../../../dynamo/models/blog';
import Cube from '../../../dynamo/models/cube';
import Feed from '../../../dynamo/models/feed';
import User from '../../../dynamo/models/user';
import { csrfProtection, ensureAuth } from '../../../routes/middleware';
import { Request, Response } from '../../../types/express';
import { abbreviate, isCubeViewable } from '../../../util/cubefn';
import generateMeta from '../../../util/meta';
import { render } from '../../../util/render';
import util from '../../../util/util';

const { redirect } = require('../../../util/render');

import { FeedTypes } from '../../../datatypes/Feed';
import UserType from '../../../datatypes/User';

export const createBlogHandler = async (req: Request, res: Response) => {
  try {
    if (req.body.title.length < 5 || req.body.title.length > 100) {
      req.flash('danger', 'Blog title length must be between 5 and 100 characters.');

      return redirect(req, res, `/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    const { user } = req;

    if (!user) {
      req.flash('danger', 'Please Login to publish a blog post.');

      return redirect(req, res, `/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    if (req.body.id && req.body.id.length > 0) {
      // update an existing blog post
      const blog = await Blog.getUnhydrated(req.body.id);
      if (!blog) {
        req.flash('danger', 'Blog not found.');

        return redirect(req, res, '/404');
      }

      if (blog.owner !== user.id) {
        req.flash('danger', 'Unable to update this blog post: Unauthorized.');

        return redirect(req, res, `/cube/blog/${encodeURIComponent(req.params.id)}`);
      }

      blog.body = req.body.markdown.substring(0, 10000);
      blog.title = req.body.title;

      await Blog.put(blog);

      req.flash('success', 'Blog update successful');

      return redirect(req, res, `/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, user)) {
      req.flash('danger', 'Cube not found');

      return redirect(req, res, '/cube/blog/404');
    }

    // if this cube has no cards, we deny them from making any changes
    // this is a spam prevention measure
    if (cube.cardCount === 0) {
      req.flash('danger', 'Cannot post a blog for an empty cube. Please add cards to the cube first.');

      return redirect(req, res, '/cube/blog/' + cube.id);
    }

    if (cube.owner.id !== user.id) {
      req.flash('danger', 'Unable to post this blog post: Unauthorized.');
      return redirect(req, res, `/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    const id: string = await Blog.put({
      body: req.body.markdown?.substring(0, 10000) || '',
      owner: user.id,
      date: new Date().valueOf(),
      cube: cube.id,
      title: req.body.title,
    });

    //Front-end joins the mentioned usernames with ; for the Form
    const userMentions: string[] = req.body.mentions ? req.body.mentions.split(';') : [];
    const mentionedUsers: UserType[] = [];

    // mentions are only added for new posts and ignored on edits
    if (userMentions.length > 0) {
      for (const mention of userMentions) {
        const mentioned: UserType = await User.getByUsername(mention);

        if (mentioned) {
          mentionedUsers.push(mentioned);
          await util.addNotification(
            mentioned,
            user,
            `/cube/blog/blogpost/${id}`,
            `${user.username} mentioned you in their blog post`,
          );
        }
      }
    }

    const followers: string[] = [
      ...new Set([...(user.following || []), ...cube.following, ...mentionedUsers.map((u) => u.id)]),
    ];

    const feedItems = followers.map((userId) => ({
      id,
      to: userId,
      date: new Date().valueOf(),
      type: FeedTypes.BLOG,
    }));

    await Feed.batchPut(feedItems);

    req.flash('success', 'Blog post successful');

    return redirect(req, res, `/cube/blog/${encodeURIComponent(req.params.id)}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/blog/${encodeURIComponent(req.params.id)}`);
  }
};

export const getBlogPostHandler = async (req: Request, res: Response) => {
  try {
    const post = await Blog.getById(req.params.id);
    if (!post) {
      req.flash('danger', 'Blog post not found');

      return redirect(req, res, '/404');
    }

    if (post.cube !== 'DEVLOG') {
      const cube = await Cube.getById(post.cube);

      if (!isCubeViewable(cube, req.user)) {
        req.flash('danger', 'Blog post not found');

        return redirect(req, res, '/404');
      }
    }

    return render(req, res, 'BlogPostPage', { post });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
};

export const deleteBlogHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (!user) {
      req.flash('danger', 'Please login to delete a blog post.');

      return redirect(req, res, `/cube/blog/${encodeURIComponent(id)}`);
    }

    const blog = await Blog.getById(id);

    if (!blog) {
      req.flash('danger', 'Blog post not found');
      return redirect(req, res, '/404');
    }

    if (blog.owner.id !== user.id) {
      req.flash('danger', 'Unauthorized');
      return redirect(req, res, '/404');
    }

    await Blog.delete(id);

    req.flash('success', 'Post Removed');
    return redirect(req, res, `/cube/blog/${encodeURIComponent(blog.cube)}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
};

export const getMoreBlogPostsForCubeHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;
  const posts = await Blog.getByCube(req.params.id, 20, lastKey);

  return res.status(200).send({
    success: 'true',
    items: posts.items,
    lastKey: posts.lastKey,
  });
};

export const getBlogPostsForCubeHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const query = await Blog.getByCube(cube.id, 20);
    const baseUrl = util.getBaseUrl();

    return render(
      req,
      res,
      'CubeBlogPage',
      {
        cube,
        posts: query.items,
        lastKey: query.lastKey,
      },
      {
        title: `${abbreviate(cube.name)} - Blog`,
        metadata: generateMeta(
          `Cube Cobra Blog: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/blog/${encodeURIComponent(req.params.id)}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${encodeURIComponent(req.params.id)}`);
  }
};

export const routes = [
  {
    method: 'post',
    path: '/post/:id',
    handler: [ensureAuth, csrfProtection, createBlogHandler],
  },
  {
    method: 'get',
    path: '/blogpost/:id',
    handler: [csrfProtection, getBlogPostHandler],
  },
  {
    method: 'get',
    path: '/remove/:id',
    handler: [ensureAuth, csrfProtection, deleteBlogHandler],
  },
  {
    method: 'post',
    path: '/getmoreblogsbycube/:id',
    handler: [csrfProtection, getMoreBlogPostsForCubeHandler],
  },
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, getBlogPostsForCubeHandler],
  },
];
