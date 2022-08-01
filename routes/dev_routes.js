const express = require('express');

const { csrfProtection, ensureRole } = require('./middleware');
const { render } = require('../serverjs/render');

const Blog = require('../dynamo/models/blog');

const router = express.Router();

router.use(csrfProtection);

router.get('/blog', async (req, res) => {
  const blogs = await Blog.getByCubeId('DEVBLOG', 10);

  return render(req, res, 'DevBlog', {
    blogs: blogs.items,
    lastKey: blogs.lastKey,
  });
});

router.post('/getmoreblogs', async (req, res) => {
  const { lastKey } = req.body;
  const blogs = await Blog.getByCubeId('DEVBLOG', 10, lastKey);

  return res.status(200).send({
    success: 'true',
    blogs: blogs.items,
    lastKey: blogs.lastKey,
  });
});

router.post('/blogpost', ensureRole('Admin'), async (req, res) => {
  try {
    const blogpost = {
      Body: req.body.body,
      Owner: req.user.Id,
      Date: Date.now().valueOf(),
      CubeId: 'DEVBLOG',
      Title: req.body.title,
    };

    await Blog.put(blogpost);

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
