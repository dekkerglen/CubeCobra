// Load Environment Variables
require('dotenv').config();

const express = require('express');
const { ensureAuth, csrfProtection } = require('./middleware');

const util = require('../serverjs/util.js');
const { sanitize } = require('../serverjs/cubefn.js');
const Comment = require('../models/comment');
const User = require('../models/user');
const Report = require('../models/report');
const Deck = require('../models/deck');
const Article = require('../models/article');
const Video = require('../models/video');
const Podcast = require('../models/podcast');
const PodcastEpisode = require('../models/podcastEpisode');
const Blog = require('../models/blog');
const { render } = require('../serverjs/render');

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
  article: async (id) => {
    const article = await Article.findById(id);
    return [article.owner, 'article'];
  },
  podcast: async (id) => {
    const podcast = await Podcast.findById(id);
    return [podcast.owner, 'podcast'];
  },
  video: async (id) => {
    const video = await Video.findById(id);
    return [video.owner, 'video'];
  },
  episode: async (id) => {
    const episode = await PodcastEpisode.findById(id);
    return [episode.owner, 'podcast episode'];
  },
  default: async () => null, // nobody gets a notification for this
};

router.post(
  '/:type/:parent',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const poster = await User.findById(req.user.id);

    if (!['comment', 'blog', 'deck', 'card', 'article', 'podcast', 'video', 'episode'].includes(req.params.type)) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid comment parent type.',
      });
    }

    const comment = new Comment();

    comment.parent = req.params.parent.substring(0, 500);
    comment.parentType = req.params.type.substring(0, 500);
    comment.owner = poster._id;
    comment.ownerName = poster.username;
    comment.image = poster.image;
    comment.artist = poster.artist;
    comment.updated = false;
    comment.content = sanitize(req.body.comment.substring(0, 5000));
    // the -1000 is to prevent weird time display error
    comment.timePosted = Date.now() - 1000;
    comment.date = Date.now() - 1000;

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
  '/edit',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const newComment = req.body.comment;

    const comment = await Comment.findById(newComment._id);

    if (comment.owner !== req.user.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Comments can only be edited by their owner.',
      });
    }

    if (
      ![null, comment.owner].includes(newComment.owner) ||
      ![null, comment.ownerName].includes(newComment.ownerName)
    ) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid comment update.',
      });
    }

    comment.owner = newComment.owner;
    comment.ownerName = newComment.ownerName;
    comment.image = newComment.owner
      ? req.user.image
      : 'https://img.scryfall.com/cards/art_crop/front/0/c/0c082aa8-bf7f-47f2-baf8-43ad253fd7d7.jpg?1562826021';
    comment.artist = newComment.owner ? 'Allan Pollack' : req.user.artist;
    comment.updated = true;
    comment.content = sanitize(newComment.content.substring(0, 500));
    // the -1000 is to prevent weird time display error
    comment.timePosted = Date.now() - 1000;

    await comment.save();

    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/report',
  util.wrapAsyncApi(async (req, res) => {
    const { commentid, info, reason } = req.body;

    const report = new Report();
    report.commentid = commentid;
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

    return render(
      req,
      res,
      'CommentPage',
      {
        comment,
      },
      {
        title: 'Comment',
      },
    );
  }),
);

module.exports = router;
