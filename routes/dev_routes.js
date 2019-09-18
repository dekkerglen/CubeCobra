const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const emailconfig = require('../../cubecobrasecrets/email');
const mailer = require("nodemailer");
const fs = require('fs')

// Bring in models
let User = require('../models/user')
let Blog = require('../models/blog')

var adminname = 'Dekkaru';

router.get('/blog', function(req, res) {
  res.redirect('/dev/blog/0');
});

router.get('/blog/:id', function(req, res) {
  if (!req.user) {
    req.user = {
      _id: ''
    };
  }
  User.findById(req.user._id, function(err, user) {
    var admin = false;
    if (user && user.username == adminname) {
      //admin
      admin = true;
    }
    Blog.find({
      dev: 'true'
    }).sort('date').exec(function(err, blogs) {
      blogs.forEach(function(item, index) {
        if (!item.date_formatted) {
          item.date_formatted = item.date.toLocaleString("en-US");
        }
      });
      var pages = [];
      blogs.reverse();
      if (blogs.length > 10) {
        var page = parseInt(req.params.id);
        if (!page) {
          page = 0;
        }
        for (i = 0; i < blogs.length / 10; i++) {
          if (page == i) {
            pages.push({
              url: '/dev/blog/' + i,
              content: (i + 1),
              active: true
            });
          } else {
            pages.push({
              url: '/dev/blog/' + i,
              content: (i + 1)
            });
          }
        }
        blog_page = [];
        for (i = 0; i < 10; i++) {
          if (blogs[i + page * 10]) {
            blog_page.push(blogs[i + page * 10]);
          }
        }

        if (admin) {
          res.render('blog/devblog', {
            blogs: blog_page,
            pages: pages,
            admin: 'true',
            loginCallback: '/dev/blog/' + req.params.id
          });
        } else {
          res.render('blog/devblog', {
            blogs: blog_page,
            pages: pages,
            loginCallback: '/dev/blog/' + req.params.id
          });
        }
      } else {
        if (admin) {
          res.render('blog/devblog', {
            blogs: blogs,
            admin: 'true',
            loginCallback: '/dev/blog/' + req.params.id
          });
        } else {
          res.render('blog/devblog', {
            blogs: blogs,
            loginCallback: '/dev/blog/' + req.params.id
          });
        }
      }
    });
  });
});

router.post('/blogpost', ensureAuth, function(req, res) {
  User.findById(req.user._id, function(err, user) {
    if (user && user.username == adminname) {
      var blogpost = new Blog();
      blogpost.title = req.body.title;
      if (req.body.html && req.body.html.length > 0) {
        blogpost.html = req.body.html;
      } else {
        blogpost.body = req.body.body;
      }
      blogpost.owner = user._id;
      blogpost.date = Date.now();
      blogpost.dev = 'true';
      blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

      //console.log(draft);
      blogpost.save(function(err) {
        if (err) {
          console.log(err);
        } else {
          req.flash('success', 'Blog post successful');
          res.redirect('/dev/blog');
        }
      });
    } else {
      res.status(404).render('misc/404', {});
    }
  });
});


function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.flash('danger', 'Please login to view this content');
    res.redirect('/user/login');
  }
}

module.exports = router;
