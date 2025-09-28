import Blog from '../../../dynamo/models/blog';
import Cube from '../../../dynamo/models/cube';
import Feed from '../../../dynamo/models/feed';
import User from '../../../dynamo/models/user';
import { csrfProtection, ensureAuth, ensureAuthJson } from '../../../routes/middleware';
import { Request, Response } from '../../../types/express';
import { abbreviate, isCubeViewable } from '../../../util/cubefn';
import generateMeta from '../../../util/meta';
import { render } from '../../../util/render';
import util from '../../../util/util';

const { handleRouteError, redirect } = require('../../../util/render');

import CubeType from '../../../datatypes/Cube';
import { FeedTypes } from '../../../datatypes/Feed';
import UserType from '../../../datatypes/User';

const getRedirectUrl = async (req: Request, cubeId: string, isDelete: boolean = false): Promise<string> => {
  const cube = await Cube.getById(cubeId);
  return await getRedirectUrlForCube(req, cube, isDelete);
};

const getRedirectUrlForCube = async (req: Request, cube: CubeType, isDelete: boolean = false): Promise<string> => {
  const referrer = util.getSafeReferrer(req);

  //Prefer short ID in the URL if the cube has it
  const cubeOrFallbackUrl = cube ? `/cube/blog/${encodeURIComponent(cube.shortId || cube.id)}` : '/dashboard';
  //If not a valid referrer on this website, either send to the cube (if it exists) or the dashboard
  if (referrer === null) {
    return cubeOrFallbackUrl;
  }

  const isUserBlog = referrer.includes('/user/blog/');
  const isBlogPost = referrer.includes('/cube/blog/blogpost/');

  //When the blog is deleted we can't redirect to itself even if that is where user was
  if (isDelete) {
    if (isUserBlog) {
      return referrer;
    } else {
      return cubeOrFallbackUrl;
    }
  }

  //Use the referrer to know where to return the user, based on the places blog posts can be seen
  if (isUserBlog) {
    return referrer;
  } else if (isBlogPost) {
    return referrer;
    //Ugly to check both here, but if the blogpost was deleted from itself the referrer still contains /cube/blog/ (and more)
  } else {
    return cubeOrFallbackUrl;
  }
};

export const createBlogHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.id;
    //Generally going to assume the cube exists here. Definitely required for a new blog, not so for an edit
    const cube = await Cube.getById(cubeId);

    if (req.body.title.length < 5 || req.body.title.length > 100) {
      res.status(400).json({ error: 'Blog title length must be between 5 and 100 characters.' });
      return;
    }

    const { user } = req;

    if (!user) {
      res.status(401).json({ error: 'Please Login to publish a blog post.' });
      return;
    }

    if (req.body.markdown && req.body.markdown.length > 10000) {
      res.status(400).json({ error: 'Blog post markdown cannot be longer than 10,000 characters.' });
      return;
    }

    if (req.body.id && req.body.id.length > 0) {
      // update an existing blog post
      const blog = await Blog.getUnhydrated(req.body.id);
      if (!blog) {
        res.status(404).json({ error: 'Blog not found.' });
        return;
      }

      if (blog.owner !== user.id) {
        res.status(403).json({ error: 'Unable to update this blog post: Unauthorized.' });
        return;
      }

      blog.body = req.body.markdown.substring(0, 10000);
      blog.title = req.body.title;

      await Blog.put(blog);

      const redirectUrl = await getRedirectUrlForCube(req, cube);
      res.status(200).json({ ok: 'Blog update successful, reloading...', redirect: redirectUrl });
      return;
    }

    if (!isCubeViewable(cube, user)) {
      res.status(404).json({ error: 'Cube not found' });
      return;
    }

    // if this cube has no cards, we deny them from making any changes
    // this is a spam prevention measure
    if (cube.cardCount === 0) {
      res.status(400).json({ error: 'Cannot post a blog for an empty cube. Please add cards to the cube first.' });
      return;
    }

    if (cube.owner.id !== user.id) {
      res.status(403).json({ error: 'Unable to post this blog post: Unauthorized.' });
      return;
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

    const redirectUrl = await getRedirectUrlForCube(req, cube);
    res.status(200).json({ ok: 'Blog post successful, reloading...', redirect: redirectUrl });
    return;
  } catch {
    res.status(500).json({ error: 'Unexpected error.' });
    return;
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

    return render(req, res, 'BlogPostPage', { post }, { noindex: true });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const deleteBlogHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user } = req;

    //The ensureAuth middleware means this should never occur
    if (!user) {
      req.flash('danger', 'Please login to delete a blog post.');

      return redirect(req, res, `/cube/blog/blogpost/${encodeURIComponent(id)}`);
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
    const redirectUrl = await getRedirectUrl(req, blog.cube, true);

    req.flash('success', 'Post Removed');
    return redirect(req, res, redirectUrl);
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
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
    return handleRouteError(req, res, err, `/cube/overview/${encodeURIComponent(req.params.id)}`);
  }
};

export const routes = [
  {
    method: 'post',
    path: '/post/:id',
    handler: [ensureAuthJson, csrfProtection, createBlogHandler],
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
