const express = require('express');

const { csrfProtection, ensureRole } = require('./middleware');
const { render } = require('../serverutils/render');

const Blog = require('dynamo/models/blog');
const Feed = require('dynamo/models/feed');

import { FeedTypes } from '@utils/datatypes/Feed';
import { UserRoles } from '@utils/datatypes/User';

const router = express.Router();

router.use(csrfProtection);

router.get('/blog', async (req, res) => {
  const blogs = await Blog.getByCube('DEVBLOG', 10);

  return render(req, res, 'DevBlog', {
    blogs: blogs.items,
    lastKey: blogs.lastKey,
  });
});

router.post('/getmoreblogs', async (req, res) => {
  const { lastKey } = req.body;
  const blogs = await Blog.getByCube('DEVBLOG', 10, lastKey);

  return res.status(200).send({
    success: 'true',
    blogs: blogs.items,
    lastKey: blogs.lastKey,
  });
});

router.post('/blogpost', ensureRole(UserRoles.ADMIN), async (req, res) => {
  try {
    const blogpost = {
      body: req.body.body,
      owner: req.user.id,
      date: Date.now().valueOf(),
      cube: 'DEVBLOG',
      title: req.body.title,
    };

    const id = await Blog.put(blogpost);

    const feedItems = req.user.following.map((user) => ({
      id,
      to: user,
      date: blogpost.date,
      type: FeedTypes.BLOG,
    }));

    await Feed.batchPut(feedItems);

    return res.status(200).send({
      success: 'true',
      blogpost,
    });
  } catch (err) {
    return res.status(500).send({
      success: 'true',
      error: err.message,
    });
  }
});

module.exports = router;
