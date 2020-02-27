const express = require('express');
const util = require('../serverjs/util.js');

const { ensureAuth, csrfProtection } = require('./middleware');

// Bring in models
const User = require('../models/user');
const Blog = require('../models/blog');

const router = express.Router();

router.use(csrfProtection);

router.get('/blog', (req, res) => {
  res.redirect('/dev/blog/0');
});

router.get('/blog/:id', (req, res) => {
  if (!req.user) {
    req.user = {
      _id: '',
    };
  }
  User.findById(req.user._id, (err2, user) => {
    const admin = util.isAdmin(user);

    Blog.find({
      dev: 'true',
    })
      .sort('date')
      .exec((err3, blogs) => {
        for (const item of blogs) {
          if (!item.date_formatted) {
            item.date_formatted = item.date.toLocaleString('en-US');
          }
        }
        const pages = [];
        blogs.reverse();
        if (blogs.length > 10) {
          let page = parseInt(req.params.id, 10);
          if (!page) {
            page = 0;
          }
          for (let i = 0; i < blogs.length / 10; i++) {
            if (page === i) {
              pages.push({
                url: `/dev/blog/${i}`,
                content: i + 1,
                active: true,
              });
            } else {
              pages.push({
                url: `/dev/blog/${i}`,
                content: i + 1,
              });
            }
          }
          const blogPage = [];
          for (let i = 0; i < 10; i++) {
            if (blogs[i + page * 10]) {
              blogPage.push(blogs[i + page * 10]);
            }
          }

          if (admin) {
            res.render('blog/devblog', {
              blogs: blogPage,
              pages,
              admin: 'true',
              loginCallback: `/dev/blog/${req.params.id}`,
            });
          } else {
            res.render('blog/devblog', {
              blogs: blogPage,
              pages,
              loginCallback: `/dev/blog/${req.params.id}`,
            });
          }
        } else if (admin) {
          res.render('blog/devblog', {
            blogs,
            admin: 'true',
            loginCallback: `/dev/blog/${req.params.id}`,
          });
        } else {
          res.render('blog/devblog', {
            blogs,
            loginCallback: `/dev/blog/${req.params.id}`,
          });
        }
      });
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
