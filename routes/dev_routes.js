const express = require('express');
const util = require('../serverjs/util');

const { ensureAuth, csrfProtection } = require('./middleware');
const { render } = require('../serverjs/render');

// Bring in models
const User = require('../models/user');
const Blog = require('../models/blog');

const router = express.Router();

router.use(csrfProtection);

router.get('/blog', (req, res) => {
  res.redirect('/dev/blog/0');
});

const PAGESIZE = 10;

router.get('/blog/:id', async (req, res) => {
  const blogs = await Blog.find({
    dev: 'true',
  })
    .sort({ date: -1 })
    .skip(PAGESIZE * req.params.id)
    .limit(PAGESIZE);

  const count = await Blog.countDocuments({ dev: 'true' });

  for (const item of blogs) {
    if (!item.date_formatted) {
      item.date_formatted = item.date.toLocaleString('en-US');
    }
  }

  return render(req, res, 'DevBlog', {
    blogs,
    pages: Math.ceil(count / PAGESIZE),
    activePage: req.params.id,
  });
});

router.post('/blogpost', ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user && util.isAdmin(user)) {
      const blogpost = new Blog();
      blogpost.title = req.body.title;
      if (req.body.html && req.body.html.length > 0) {
        blogpost.html = req.body.html;
      } else {
        blogpost.body = req.body.body;
      }
      blogpost.owner = user._id;
      blogpost.date = Date.now();
      blogpost.dev = 'true';
      blogpost.date_formatted = blogpost.date.toLocaleString('en-US');

      await blogpost.save();

      req.flash('success', 'Blog post successful');
      res.redirect('/dev/blog');
    }
  } catch (err) {
    res.status(500).send({
      success: 'false',
      message: err,
    });
    req.logger.error(err);
  }
});

module.exports = router;
