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
    return [comment.owner, 'comment'];
  },
  blog: async (id) => {
    const blog = await Blog.getById(id);
    return [blog.owner, 'blogpost'];
  },
  deck: async (id) => {
    const deck = await Draft.getById(id);
    return [deck.owner, 'deck'];
  },
  article: async (id) => {
    const article = await Content.getById(id);
    return [article.owner, 'article'];
  },
  podcast: async (id) => {
    const podcast = await Content.getById(id);
    return [podcast.owner, 'podcast'];
  },
  video: async (id) => {
    const video = await Content.getById(id);
    return [video.owner, 'video'];
  },
  episode: async (id) => {
    const episode = await Content.getById(id);
    return [episode.owner, 'podcast episode'];
  },
  package: async (id) => {
    const pack = await Package.getById(id);
    return [pack.owner, 'card package'];
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
      owner: user.id,
      body: body.substring(0, 5000),
      date: Date.now() - 1000,
      parent: parent.substring(0, 500),
      type,
    };

    const id = await Comment.put(comment);

    const [owner] = await getReplyContext[type](parent);

    if (owner) {
      await util.addNotification(
        owner,
        user,
        `/comment/${id}`,
        `${user.username} left a comment in response to your ${type}.`,
      );
    }

    for (const mention of mentions) {
      const mentioned = await User.getByUsername(mention);
      if (mentioned) {
        await util.addNotification(
          mentioned,
          user,
          `/comment/${id}`,
          `${user.username} mentioned you in their comment`,
        );
      }
    }

    return res.status(200).send({
      success: 'true',
      comment: {
        ...comment,
        owner: req.user,
        id,
        image: util.getImageData(req.user.imageName),
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

    if (document.owner !== req.user.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Comments can only be edited by their owner.',
      });
    }

    document.body = content.substring(0, 5000);

    if (remove) {
      document.owner = null;
    }

    await Comment.put(document);

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
      subject: commentid,
      body: `${reason}\n\n${info}`,
      user: req.user ? req.user.id : null,
      date: Date.now().valueOf(),
      type: Notice.TYPE.COMMENT_REPORT,
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

    if (!comment) {
      req.flash('danger', 'Comment not found.');
      return res.redirect('/404');
    }

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
