/* eslint-disable no-await-in-loop */
const express = require('express');

const { ensureAuth } = require('../middleware');
const carddb = require('../../serverjs/cards');
const util = require('../../serverjs/util');
const { render } = require('../../serverjs/render');
const generateMeta = require('../../serverjs/meta');
const miscutil = require('../../dist/utils/Util');

const { setCubeType, buildIdQuery, abbreviate, isCubeViewable } = require('../../serverjs/cubefn');

const Cube = require('../../dynamo/models/cube');
const Blog = require('../../models/blog');
const User = require('../../dynamo/models/user');
const { fillBlogpostChangelog } = require('../../serverjs/blogpostUtils');

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
      const blog = await Blog.findById(req.body.id);

      if (!blog.owner.equals(user.Id)) {
        req.flash('danger', 'Unable to update this blog post: Unauthorized.');
        return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
      }

      blog.markdown = req.body.markdown.substring(0, 10000);
      blog.title = req.body.title;

      await blog.save();

      req.flash('success', 'Blog update successful');
      return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/blog/404');
    }

    // post new blog
    if (cube.Owner !== user.Id) {
      req.flash('danger', 'Unable to post this blog post: Unauthorized.');
      return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    const blogpost = new Blog();
    blogpost.markdown = req.body.markdown.substring(0, 10000);
    blogpost.title = req.body.title;
    blogpost.owner = user.Id;
    blogpost.date = Date.now();
    blogpost.cube = cube.Id;
    blogpost.dev = 'false';
    blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
    blogpost.username = user.Username;
    blogpost.cubename = cube.Name;

    await blogpost.save();

    // mentions are only added for new posts and ignored on edits
    if (req.body.mentions) {
      for (const mention of req.body.mentions) {
        const query = await User.getByUsername(mention);

        if (query.items.length > 0) {
          await util.addNotification(
            query.items[0],
            user,
            `/cube/blog/blogpost/${blogpost._id}`,
            `${user.Username} mentioned you in their blog post`,
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
    const post = await Blog.findById(req.params.id);
    const cube = await Cube.getById(post.cube);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Blog post not found');
      return res.redirect('/cube/blog/404');
    }
    fillBlogpostChangelog(post);
    return render(req, res, 'BlogPostPage', {
      post,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.delete('/remove/:id', ensureAuth, async (req, res) => {
  try {
    const query = {
      _id: req.params.id,
    };

    const blog = await Blog.findById(req.params.id);

    if (!req.blog.owner.equals(user.Id)) {
      req.flash('danger', 'Unauthorized');
      return res.redirect('/404');
    }
    await Blog.deleteOne(query);

    req.flash('success', 'Post Removed');
    return res.send('Success');
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting post.',
    });
  }
});

router.get(
  '/src/:id',
  util.wrapAsyncApi(async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).send({
        success: 'false',
        message: 'Blog post not found',
      });
    }
    const cube = await Cube.getById(blog.cube);
    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        messasge: 'Blog post not found',
      });
    }

    return res.status(200).send({
      success: 'true',
      src: blog.html,
      title: blog.title,
      body: blog.body,
    });
  }),
);

router.get('/:id', (req, res) => {
  res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}/0`);
});

router.get('/:id/:page', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const countQ = Blog.countDocuments({
      cube: cube.Id,
    });
    const blogsQ = Blog.find({
      cube: cube.Id,
    })
      .sort({
        date: -1,
      })
      .skip(Math.max(req.params.page, 0) * 10)
      .limit(10)
      .lean();
    const [blogs, count] = await Promise.all([blogsQ, countQ]);
    blogs.forEach(fillBlogpostChangelog);

    return render(
      req,
      res,
      'CubeBlogPage',
      {
        cube,
        posts: blogs,
        pages: Math.ceil(count / 10),
        activePage: Math.max(req.params.page, 0),
      },
      {
        title: `${abbreviate(cube.Name)} - Blog`,
        metadata: generateMeta(
          `Cube Cobra Blog: ${cube.Name}`,
          cube.Description,
          cube.ImageUri,
          `https://cubecobra.com/cube/blog/${encodeURIComponent(req.params.id)}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${encodeURIComponent(req.params.id)}`);
  }
});

module.exports = router;
