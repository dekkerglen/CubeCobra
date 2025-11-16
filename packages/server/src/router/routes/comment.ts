import type Comment from '@utils/datatypes/Comment';
import { isCommentType, isNotifiableCommentType, NotifiableCommentType } from '@utils/datatypes/Comment';
import { NoticeType } from '@utils/datatypes/Notice';
import User from '@utils/datatypes/User';
import { commentDao } from 'dynamo/daos';
import Blog from 'dynamo/models/blog';
import Content from 'dynamo/models/content';
import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import Notice from 'dynamo/models/notice';
import Package from 'dynamo/models/package';
import Record from 'dynamo/models/record';
import DynamoUser from 'dynamo/models/user';
import { csrfProtection, ensureAuth } from 'routes/middleware';
import { getImageData } from 'serverutils/imageutil';
import util from 'serverutils/util';

import { Request, Response } from '../../types/express';

const { handleRouteError, redirect, render } = require('serverutils/render');

export const getHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid comment ID');
      return redirect(req, res, '/404');
    }

    const comment = await commentDao.getById(req.params.id);

    if (!comment) {
      req.flash('danger', 'Comment not found.');
      return redirect(req, res, '/404');
    }

    return render(req, res, 'CommentPage', { comment }, { title: 'Comment' });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
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
    return handleRouteError(req, res, err, '/404');
  }
};

export const getCommentsHandler = async (req: Request, res: Response) => {
  try {
    const { parent, lastKey } = req.body;
    const comments = await commentDao.queryByParent(parent, lastKey);

    return res.status(200).send({
      success: 'true',
      comments: comments.items,
      lastKey: comments.lastKey,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const editCommentHandler = async (req: Request, res: Response) => {
  const { id, content, remove } = req.body.comment;

  const comment = await commentDao.getById(id);

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

  await commentDao.put(comment);

  return res.status(200).send({ success: 'true' });
};

export const addCommentHandler = async (req: Request, res: Response) => {
  const { body, mentions = '', parent, type } = req.body;
  const { user } = req;

  if (!user) {
    return res.status(401).send({
      success: 'false',
      message: 'User not authenticated.',
    });
  }

  if (!isCommentType(type)) {
    return res.status(400).send({
      success: 'false',
      message: 'Invalid comment parent type.',
    });
  }

  const comment: Omit<Comment, 'id'> = {
    owner: user,
    body: body.substring(0, 5000),
    date: Date.now() - 1000,
    parent: parent.substring(0, 500),
    type,
  };

  const createdComment = await commentDao.createComment(comment);
  const id = createdComment.id;

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
    const comment = await commentDao.getById(id);
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
  record: async (id: string) => {
    const record = await Record.getById(id);
    if (!record) {
      return undefined;
    }
    const cube = await Cube.getById(record.cube);
    return cube?.owner;
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
