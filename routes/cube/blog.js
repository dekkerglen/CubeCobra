/* eslint-disable no-await-in-loop */
const express = require('express');

const { ensureAuth } = require('../middleware');
const util = require('../../serverjs/util');
const { render } = require('../../serverjs/render');
const generateMeta = require('../../serverjs/meta');

const { abbreviate, isCubeViewable } = require('../../serverjs/cubefn');

const Cube = require('../../dynamo/models/cube');
const Blog = require('../../dynamo/models/blog');
const User = require('../../dynamo/models/user');
const Feed = require('../../dynamo/models/feed');

const router = express.Router();

router.post('/post/:id', ensureAuth, async (req, res) => {
  try {
    if (req.body.title.length < 5 || req.body.title.length > 100) {
      req.flash('danger', 'Blog title length must be between 5 and 100 characters.');
      return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    const { user } = req;

    if (req.body.id && req.body.id.length > 0) {
      // update an existing blog post
      const blog = await Blog.getUnhydrated(req.body.id);

      if (blog.owner !== user.id) {
        req.flash('danger', 'Unable to update this blog post: Unauthorized.');
        return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
      }

      blog.body = req.body.markdown.substring(0, 10000);
      blog.title = req.body.title;

      await Blog.put(blog);

      req.flash('success', 'Blog update successful');
      return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/blog/404');
    }

    // post new blog
    if (cube.owner.id !== user.id) {
      req.flash('danger', 'Unable to post this blog post: Unauthorized.');
      return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    const id = await Blog.put({
      body: req.body.markdown.substring(0, 10000),
      owner: user.id,
      date: new Date().valueOf(),
      cube: cube.id,
      title: req.body.title,
    });

    const followers = [...new Set([...(req.user.following || []), ...cube.following, ...(req.body.mentions || [])])];

    const feedItems = followers.map((userId) => ({
      id,
      to: userId,
      date: new Date().valueOf(),
      type: Feed.TYPES.BLOG,
    }));

    await Feed.batchPut(feedItems);

    // mentions are only added for new posts and ignored on edits
    if (req.body.mentions) {
      for (const mention of req.body.mentions) {
        const mentioned = await User.getByUsername(mention);

        if (mentioned) {
          await util.addNotification(
            mentioned,
            user,
            `/cube/blog/blogpost/${id}`,
            `${user.username} mentioned you in their blog post`,
          );
        }
      }
    }

    req.flash('success', 'Blog post successful');
    return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/blog/${encodeURIComponent(req.params.id)}`);
  }
});

router.get('/blogpost/:id', async (req, res) => {
  try {
    const post = await Blog.getById(req.params.id);

    if (post.cube !== 'DEVBLOG') {
      const cube = await Cube.getById(post.cube);

      if (!isCubeViewable(cube, req.user)) {
        req.flash('danger', 'Blog post not found');
        return res.redirect('/cube/blog/404');
      }
    }

    return render(req, res, 'BlogPostPage', {
      post,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.delete('/remove/:id', ensureAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.getById(id);

    if (blog.owner.id !== req.user.id) {
      req.flash('danger', 'Unauthorized');
      return res.redirect('/404');
    }

    await Blog.delete(id);

    req.flash('success', 'Post Removed');
    return res.send('Success');
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting post.',
    });
  }
});

router.post('/getmoreblogsbycube', async (req, res) => {
  const { lastKey, cube } = req.body;
  const posts = await Blog.getByCube(cube, 10, lastKey);

  return res.status(200).send({
    success: 'true',
    posts: posts.items,
    lastKey: posts.lastKey,
  });
});

router.get('/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const query = await Blog.getByCube(cube.id, 10);

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
          `https://cubecobra.com/cube/blog/${encodeURIComponent(req.params.id)}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${encodeURIComponent(req.params.id)}`);
  }
});

module.exports = router;
