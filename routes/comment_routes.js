/* eslint-disable no-await-in-loop */
// Load Environment Variables
require('dotenv').config();

const express = require('express');
const { ensureAuth, csrfProtection } = require('./middleware');

const util = require('../serverjs/util');
const Comment = require('../models/comment');
const User = require('../dynamo/models/user');
const Deck = require('../models/deck');
const Content = require('../dynamo/models/content');
const Blog = require('../models/blog');
const Package = require('../models/package');
const Notice = require('../dynamo/models/notice');
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
    const article = await Content.getById(id);
    return [article.Owner, 'article'];
  },
  podcast: async (id) => {
    const podcast = await Content.getById(id);
    return [podcast.Owner, 'podcast'];
  },
  video: async (id) => {
    const video = await Content.getById(id);
    return [video.Owner, 'video'];
  },
  episode: async (id) => {
    const episode = await Content.getById(id);
    return [episode.Owner, 'podcast episode'];
  },
  package: async (id) => {
    const pack = await Package.findById(id);
    return [pack.userid, 'card package'];
  },
  default: async () => null, // nobody gets a notification for this
};

router.post(
  '/:type/:parent',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const poster = await User.getById(req.user.Id);

    if (
      !['comment', 'blog', 'deck', 'card', 'article', 'podcast', 'video', 'episode', 'package'].includes(
        req.params.type,
      )
    ) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid comment parent type.',
      });
    }

    const comment = new Comment();

    comment.parent = req.params.parent.substring(0, 500);
    comment.parentType = req.params.type;
    comment.owner = poster.Id;
    comment.ownerName = poster.Username;
    comment.image = poster.Image;
    comment.artist = poster.Artist;
    comment.updated = false;
    comment.content = req.body.comment.substring(0, 5000);
    // the -1000 is to prevent weird time display error
    comment.timePosted = Date.now() - 1000;
    comment.date = Date.now() - 1000;

    await comment.save();

    const [ownerid, type] = await getReplyContext[req.params.type](req.params.parent);

    const owner = await User.getById(ownerid);

    if (owner) {
      await util.addNotification(
        owner,
        poster,
        `/comment/${comment._id}`,
        `${poster.username} left a comment in response to your ${type}.`,
      );
    }

    if (req.body.mentions) {
      const mentions = req.body.mentions.split(';');
      for (const mention of mentions) {
        const query = await User.getByUsername(mention);
        if (query.items.length === 1) {
          await util.addNotification(
            query.items[0],
            poster,
            `/comment/${comment._id}`,
            `${poster.Username} mentioned you in their comment`,
          );
        }
      }
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

    if (!comment.owner.equals(req.user.Id)) {
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
      : 'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/0/c/0c082aa8-bf7f-47f2-baf8-43ad253fd7d7.jpg?1562826021';
    comment.artist = newComment.owner ? 'Allan Pollack' : req.user.artist;
    comment.updated = true;
    comment.content = newComment.content.substring(0, 5000);
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

    const report = {
      Subject: commentid,
      Body: `${reason}\n\n${info}`,
      User: req.user ? req.user.Id : null,
      Date: Date.now().valueOf(),
      Type: Notice.TYPE.COMMENT_REPORT,
    };

    await Notice.put(report);

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
