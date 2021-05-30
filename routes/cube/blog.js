const express = require('express');

const { ensureAuth } = require('../middleware');
const carddb = require('../../serverjs/cards.js');
const util = require('../../serverjs/util.js');
const { render } = require('../../serverjs/render');
const generateMeta = require('../../serverjs/meta.js');
const miscutil = require('../../dist/utils/Util.js');

const { setCubeType, buildIdQuery, abbreviate } = require('../../serverjs/cubefn.js');

const Cube = require('../../models/cube');
const Blog = require('../../models/blog');
const User = require('../../models/user');

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

      if (!user._id.equals(blog.owner)) {
        req.flash('danger', 'Unable to update this blog post: Unauthorized.');
        return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
      }

      blog.markdown = req.body.markdown.substring(0, 10000);
      blog.title = req.body.title;

      await blog.save();

      req.flash('success', 'Blog update successful');
      return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    let cube = await Cube.findOne(buildIdQuery(req.params.id));

    // post new blog
    if (!user._id.equals(cube.owner)) {
      req.flash('danger', 'Unable to post this blog post: Unauthorized.');
      return res.redirect(`/cube/blog/${encodeURIComponent(req.params.id)}`);
    }

    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');
    cube = setCubeType(cube, carddb);

    await cube.save();

    const blogpost = new Blog();
    blogpost.markdown = req.body.markdown.substring(0, 10000);
    blogpost.title = req.body.title;
    blogpost.owner = user._id;
    blogpost.date = Date.now();
    blogpost.cube = cube._id;
    blogpost.dev = 'false';
    blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
    blogpost.username = user.username;
    blogpost.cubename = cube.name;

    await blogpost.save();

    // mentions are only added for new posts and ignored on edits
    if (req.body.mentions) {
      const owner = await User.findById(user._id);
      const mentions = req.body.mentions.split(';');
      // mentions is either a string (if just one is found) or an array (if multiple are found)
      const query = User.find({ username_lower: mentions });
      await util.addMultipleNotifications(
        query,
        owner,
        `/cube/blog/blogpost/${blogpost._id}`,
        `${user.username} mentioned you in their blog post`,
      );
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

    if (!req.user._id.equals(blog.owner)) {
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
    res.status(200).send({
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
    const cube = await Cube.findOne(buildIdQuery(req.params.id), Cube.LAYOUT_FIELDS).lean();

    const page = parseInt(req.params.page, 10) || 0;

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const countQ = Blog.countDocuments({
      cube: cube._id,
    });
    const blogsQ = Blog.find({
      cube: cube._id,
    })
      .sort({
        date: -1,
      })
      .skip(page * 10)
      .limit(10)
      .lean();
    const [blogs, count] = await Promise.all([blogsQ, countQ]);

    return render(
      req,
      res,
      'CubeBlogPage',
      {
        cube,
        posts: blogs,
        pages: Math.ceil(count / 10),
        activePage: page,
      },
      {
        title: `${abbreviate(cube.name)} - Blog`,
        metadata: generateMeta(
          `Cube Cobra Blog: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/blog/${encodeURIComponent(req.params.id)}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${encodeURIComponent(req.params.id)}`);
  }
});

module.exports = router;
