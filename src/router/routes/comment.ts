import { isCommentType, isNotifiableCommentType, NotifiableCommentType } from '../../datatypes/Comment';
import { NoticeType } from '../../datatypes/Notice';
import User from '../../datatypes/User';
import Blog from '../../dynamo/models/blog';
import Comment from '../../dynamo/models/comment';
import Content from '../../dynamo/models/content';
import Draft from '../../dynamo/models/draft';
import Notice from '../../dynamo/models/notice';
import Package from '../../dynamo/models/package';
import * as DynamoUser from '../../dynamo/models/user';
import { csrfProtection, ensureAuth } from '../../routes/middleware';
import { Request, Response } from '../../types/express';
import { getImageData } from '../../util/imageutil';
import util from '../../util/util';

const { redirect, render } = require('../../util/render');

export const getHandler = async (req: Request, res: Response) => {
  try {
    const comment = await Comment.getById(req.params.id);

    if (!comment) {
      req.flash('danger', 'Comment not found.');
      return redirect(req, res, '/404');
    }

    return render(req, res, 'CommentPage', { comment }, { title: 'Comment' });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
};

export const reportHandler = async (req: Request, res: Response) => {
  try {
    const { commentid, info, reason } = req.body;

    const report = {
      subject: commentid,
      body: `${reason}\n\n${info}`,
      user: req.user ? req.user.id : null,
      date: Date.now().valueOf(),
      type: NoticeType.COMMENT_REPORT,
    };

    await Notice.put(report);

    req.flash(
      'success',
      'Thank you for the report! Our moderators will review the report can decide whether to take action.',
    );

    return redirect(req, res, `/comment/${commentid}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
};

export const getCommentsHandler = async (req: Request, res: Response) => {
  try {
    const { parent, lastKey } = req.body;
    const comments = await Comment.queryByParentAndType(parent, lastKey);

    return res.status(200).send({
      success: 'true',
      comments: comments.items,
      lastKey: comments.lastKey,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
};

export const editCommentHandler = async (req: Request, res: Response) => {
  const { id, content, remove } = req.body.comment;

  const comment = await Comment.getById(id);

  if (!comment) {
    return res.status(404).send({
      success: 'false',
      message: 'Comment not found.',
    });
  }

  if (comment.owner?.id !== req.user?.id) {
    return res.status(404).send({
      success: 'false',
      message: 'Comment not found.',
    });
  }

  comment.body = content.substring(0, 5000);

  if (remove) {
    comment.owner = { id: '404', username: 'Anonymous' };
  }

  await Comment.put(comment);

  return res.status(200).send({ success: 'true' });
};

export const addCommentHandler = async (req: Request, res: Response) => {
  const { body, mentions = '', parent, type } = req.body;
  const { user } = req;

  if (!isCommentType(type)) {
    return res.status(400).send({
      success: 'false',
      message: 'Invalid comment parent type.',
    });
  }

  const comment = {
    owner: user?.id,
    body: body.substring(0, 5000),
    date: Date.now() - 1000,
    parent: parent.substring(0, 500),
    type,
  };

  const id = await Comment.put(comment);

  if (isNotifiableCommentType(type)) {
    const owner = await getReplyContext[type](parent);
    if (owner) {
      await util.addNotification(
        owner,
        user,
        `/comment/${id}`,
        `${user?.username} left a comment in response to your ${type}.`,
      );
    }
  }

  //Front-end joins the mentioned usernames with ; for the Form
  const userMentions: string[] = mentions ? mentions.split(';') : []; //Stupid JS thing where split of empty string is an array of empty string
  for (const mention of userMentions) {
    const mentioned = await DynamoUser.getByUsername(mention);
    if (mentioned) {
      await util.addNotification(mentioned, user, `/comment/${id}`, `${user?.username} mentioned you in their comment`);
    }
  }

  return res.status(200).send({
    success: 'true',
    comment: {
      ...comment,
      owner: req.user,
      id,
      image: getImageData(req.user?.imageName),
    },
  });
};

export const getReplyContext: Record<NotifiableCommentType, (id: string) => Promise<User | undefined>> = {
  comment: async (id) => {
    const comment = await Comment.getById(id);
    return comment?.owner;
  },
  blog: async (id) => {
    const blog = await Blog.getById(id);
    return blog?.owner;
  },
  deck: async (id) => {
    const deck = await Draft.getById(id);
    return deck?.owner;
  },
  article: async (id) => {
    const article = await Content.getById(id);
    return article?.owner;
  },
  podcast: async (id) => {
    const podcast = await Content.getById(id);
    return podcast?.owner;
  },
  video: async (id) => {
    const video = await Content.getById(id);
    return video?.owner;
  },
  episode: async (id: string) => {
    const episode = await Content.getById(id);
    return episode?.owner;
  },
  package: async (id: string) => {
    const pack = await Package.getById(id);
    return pack?.owner;
  },
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [csrfProtection, getHandler],
  },
  {
    path: '/report',
    method: 'post',
    handler: [csrfProtection, reportHandler],
  },
  {
    path: '/getcomments',
    method: 'post',
    handler: [csrfProtection, getCommentsHandler],
  },
  {
    path: '/edit',
    method: 'post',
    handler: [ensureAuth, csrfProtection, editCommentHandler],
  },
  {
    path: '/addcomment',
    method: 'post',
    handler: [ensureAuth, csrfProtection, addCommentHandler],
  },
];
