// Load Environment Variables
require('dotenv').config();

const express = require('express');
const serialize = require('serialize-javascript');
const { ensureAuth, csrfProtection } = require('./middleware');

const util = require('../serverjs/util.js');
const { sanitize } = require('../serverjs/cubefn.js');
const Comment = require('../models/comment');
const User = require('../models/user');
const Report = require('../models/report');
const Deck = require('../models/deck');
const Blog = require('../models/blog');

const router = express.Router();

router.use(csrfProtection);

router.get(
  '/:type/:parent',
  util.wrapAsyncApi(async (req, res) => {
    const comments = await Comment.find({
      $and: [{ parent: req.params.parent }, { parentType: req.params.type }],
    }).lean();

    return res.status(200).send({
      success: 'true',
      comments,
    });
  }),
);

const getReplyContext = {
  comment: async (id) => {
    const comment = await Comment.findById(id);
    return [comment.owner, 'comment'];
  },
  blog: async (id) => {
    const blog = await Blog.findById(id);
    return [blog.owner, 'blogpost'];
  },
  deck: async (id) => {
    const deck = await Deck.findById(id);
    return [deck.owner, 'deck'];
  },
  default: async () => null, // nobody gets a notification for this
};

router.post(
  '/:type/:parent',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const poster = await User.findById(req.user.id);

    const comment = new Comment();

    comment.parent = req.params.parent;
    comment.parentType = req.params.type;
    comment.owner = poster._id;
    comment.ownerName = poster.username;
    comment.image = poster.image;
    comment.artist = poster.artist;
    comment.updated = false;
    comment.content = sanitize(req.body.comment);
    // the -1000 is to prevent weird time display error
    comment.timePosted = Date.now() - 1000;

    await comment.save();

    const [ownerid, type] = await getReplyContext[req.params.type](req.params.parent);

    const owner = await User.findById(ownerid);

    if (owner) {
      await util.addNotification(
        owner,
        poster,
        `/comment/${comment._id}`,
        `${poster.username} left a comment in response to your ${type}.`,
      );
    }

    return res.status(200).send({
      success: 'true',
      comment,
    });
  }),
);

router.post(
  '/report',
  util.wrapAsyncApi(async (req, res) => {
    const { commentid, info, reason } = req.body;

    const report = new Report();
    report.commentid = info;
    report.info = info;
    report.reason = reason;
    report.reportee = req.user ? req.user.id : null;
    report.timePosted = Date.now() - 1000;
    await report.save();

    req.flash(
      'success',
      'Thank you for the report! Our moderators will review the report can decide whether to take action.',
    );

    return res.redirect(`/comment/${commentid}`);
  }),
);

router.get(
  '/:id',
  util.wrapAsyncApi(async (req, res) => {
    const comment = await Comment.findById(req.params.id).lean();

    return res.render('tool/comment', {
      reactProps: serialize({
        comment,
        userid: req.user ? req.user.id : null,
      }),
      title: 'Comment',
    });
  }),
);

module.exports = router;
