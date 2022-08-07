/* eslint-disable no-await-in-loop */
// Load Environment Variables
require('dotenv').config();

const express = require('express');
const { ensureAuth, csrfProtection } = require('./middleware');

const util = require('../serverjs/util');
const Comment = require('../dynamo/models/comment');
const User = require('../dynamo/models/user');
const Content = require('../dynamo/models/content');
const Blog = require('../dynamo/models/blog');
const Package = require('../dynamo/models/package');
const Notice = require('../dynamo/models/notice');
const Draft = require('../dynamo/models/draft');
const { render } = require('../serverjs/render');

const router = express.Router();

router.use(csrfProtection);

const getReplyContext = {
  comment: async (id) => {
    const comment = await Comment.getById(id);
    return [comment.Owner, 'comment'];
  },
  blog: async (id) => {
    const blog = await Blog.getById(id);
    return [blog.Owner, 'blogpost'];
  },
  deck: async (id) => {
    const deck = await Draft.getById(id);
    return [deck.Owner, 'deck'];
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
    const pack = await Package.getById(id);
    return [pack.Owner, 'card package'];
  },
  default: async () => null, // nobody gets a notification for this
};

router.post(
  '/getcomments',
  util.wrapAsyncApi(async (req, res) => {
    const { parent, lastKey } = req.body;
    const comments = await Comment.queryByParentAndType(parent, lastKey);

    return res.status(200).send({
      success: 'true',
      comments: comments.items,
      lastKey: comments.lastKey,
    });
  }),
);

router.post(
  '/addcomment',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const { body, mentions = [], parent, type } = req.body;
    const { user } = req;

    if (!['comment', 'blog', 'deck', 'card', 'article', 'podcast', 'video', 'episode', 'package'].includes(type)) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid comment parent type.',
      });
    }

    const comment = {
      Owner: user.Id,
      Body: body.substring(0, 5000),
      Date: Date.now() - 1000,
      Parent: parent.substring(0, 500),
      Type: type,
    };

    const id = await Comment.put(comment);

    const [ownerid] = await getReplyContext[type](parent);

    const owner = await User.getById(ownerid);

    if (owner) {
      await util.addNotification(
        owner,
        user,
        `/comment/${comment.Id}`,
        `${user.Username} left a comment in response to your ${type}.`,
      );
    }

    for (const mention of mentions) {
      const query = await User.getByUsername(mention);
      if (query.items.length === 1) {
        await util.addNotification(
          query.items[0],
          user,
          `/comment/${comment._id}`,
          `${user.Username} mentioned you in their comment`,
        );
      }
    }

    const ImageData = util.getImageData(user.ImageName);

    return res.status(200).send({
      success: 'true',
      comment: {
        ImageData,
        User: req.user,
        Id: id,
        ...comment,
      },
    });
  }),
);

router.post(
  '/edit',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const { id, content, remove } = req.body.comment;

    const document = await Comment.getById(id);

    if (document.Owner !== req.user.Id) {
      return res.status(400).send({
        success: 'false',
        message: 'Comments can only be edited by their owner.',
      });
    }

    document.Body = content.substring(0, 5000);

    if (remove) {
      document.Owner = null;
    }

    await Comment.update(document);

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
    const comment = await Comment.getById(req.params.id);

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
