import type Comment from '@utils/datatypes/Comment';
import { isCommentType, isNotifiableCommentType, NotifiableCommentType } from '@utils/datatypes/Comment';
import { NoticeStatus, NoticeType } from '@utils/datatypes/Notice';
import { NotificationType } from '@utils/datatypes/Notification';
import User from '@utils/datatypes/User';
import {
  articleDao,
  blogDao,
  commentDao,
  cubeDao,
  draftDao,
  episodeDao,
  noticeDao,
  p1p1PackDao,
  packageDao,
  podcastDao,
  recordDao,
  userDao,
  videoDao,
} from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';
import { getImageData } from 'serverutils/imageutil';
import generateMeta, { truncateForMeta } from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { addNotification, getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../types/express';

// Comment parents that belong to a cube. Their comment threads are only as visible as the cube.
// Each resolver returns the parent's cube ID (null when it isn't attached to a cube), or
// undefined when the parent doesn't exist.
const cubeIdForParent: Partial<Record<string, (id: string) => Promise<string | null | undefined>>> = {
  blog: async (id) => {
    const blog = await blogDao.getById(id);
    if (!blog) return undefined;
    return blog.cube && blog.cube !== 'DEVBLOG' ? blog.cube : null;
  },
  deck: async (id) => {
    const deck = await draftDao.getById(id);
    if (!deck) return undefined;
    return deck.cube || null;
  },
  record: async (id) => {
    const record = await recordDao.getById(id);
    if (!record) return undefined;
    return record.cube || null;
  },
  p1p1: async (id) => {
    const pack = await p1p1PackDao.getMetadataById(id);
    if (!pack) return undefined;
    return pack.cubeId || null;
  },
};

// Replies nest comment-on-comment; deeper chains than this are refused rather than walked.
const MAX_REPLY_DEPTH = 25;

/**
 * Whether `user` may see (or, with `forWrite`, add to) the comment thread of a parent. Parents
 * that belong to a cube follow the cube's visibility; replies follow the comment they answer.
 * Parent types that aren't cube-scoped are always allowed. A missing parent is allowed for
 * reads (orphaned threads stay readable) but refused for writes.
 */
export const canAccessCommentParent = async (
  type: unknown,
  parent: unknown,
  user: User | undefined,
  forWrite = false,
  depth = 0,
): Promise<boolean> => {
  if (type === 'comment') {
    if (typeof parent !== 'string' || !parent) return !forWrite;
    if (depth >= MAX_REPLY_DEPTH) return false;
    const comment = await commentDao.getById(parent);
    if (!comment) return !forWrite;
    return canAccessCommentParent(comment.type, comment.parent, user, forWrite, depth + 1);
  }

  const resolve =
    typeof type === 'string' && Object.prototype.hasOwnProperty.call(cubeIdForParent, type)
      ? cubeIdForParent[type]
      : undefined;
  if (!resolve) {
    return true;
  }
  if (typeof parent !== 'string' || !parent) return !forWrite;

  const cubeId = await resolve(parent);
  if (cubeId === undefined) return !forWrite;
  if (cubeId === null) return true;

  const cube = await cubeDao.getById(cubeId);
  return isCubeViewable(cube, user);
};

export const getHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid comment ID');
      return redirect(req, res, '/404');
    }

    const comment = await commentDao.getById(req.params.id);

    if (!comment || !(await canAccessCommentParent(comment.type, comment.parent, req.user))) {
      req.flash('danger', 'Comment not found.');
      return redirect(req, res, '/404');
    }

    const ownerName = comment.owner?.username || 'Anonymous';
    const description = truncateForMeta(comment.body) || `A comment on Cube Cobra by ${ownerName}.`;
    return render(
      req,
      res,
      'CommentPage',
      { comment },
      {
        title: 'Comment',
        metadata: generateMeta(
          `Comment by ${ownerName}`,
          description,
          comment.image?.uri || '',
          `${getBaseUrl()}/comment/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

// The set of reasons the report form offers. Reports must use one of these
// exact values — free-form reason text was being abused to inject spam and
// SQL-injection payloads into the moderation queue.
const REPORT_REASONS = [
  'This is spam or phishing',
  'This is offensive or abusive',
  'It expresses intentions of self-harm or suicide',
];

const MAX_INFO_LENGTH = 1000;

export const reportHandler = async (req: Request, res: Response) => {
  try {
    const { commentid, info, reason } = req.body;

    // This route is auth-gated (see routes below), so req.user is always set here.
    const successFlash = () => {
      req.flash(
        'success',
        'Thank you for the report! Our moderators will review the report and decide whether to take action.',
      );
    };

    // Only allow valid UUID or MongoID
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const MONGO_ID_RE = /^[0-9a-f]{24}$/i;
    function isValidId(id: string) {
      return typeof id === 'string' && (UUID_RE.test(id) || MONGO_ID_RE.test(id));
    }
    if (!isValidId(commentid)) {
      // Silently ignore invalid IDs
      successFlash();
      return redirect(req, res, '/404');
    }

    // Only accept a reason from the known allowlist. Anything else is spam/abuse.
    if (typeof reason !== 'string' || !REPORT_REASONS.includes(reason)) {
      req.flash('danger', 'Invalid report reason.');
      return redirect(req, res, `/comment/${commentid}`);
    }

    // Optional free-text info: bound the length and never let it carry markup weight.
    const safeInfo = typeof info === 'string' ? info.slice(0, MAX_INFO_LENGTH) : '';

    // The comment must actually exist before we file a report against it.
    const comment = await commentDao.getById(commentid);
    if (!comment) {
      successFlash();
      return redirect(req, res, `/comment/${commentid}`);
    }

    // Prevent duplicate active reports for this comment by this user
    const existing = await noticeDao.getByStatus(NoticeStatus.ACTIVE);
    const alreadyReported = (existing.items || []).some(
      (n) =>
        n.type === NoticeType.COMMENT_REPORT &&
        n.subject === commentid &&
        String(n.user?.id || n.user) === String(req.user?.id),
    );
    if (alreadyReported) {
      successFlash();
      return redirect(req, res, `/comment/${commentid}`);
    }

    const report = {
      subject: commentid,
      body: `${reason}\n\n${safeInfo}`,
      user: req.user!.id,
      date: Date.now().valueOf(),
      type: NoticeType.COMMENT_REPORT,
    };

    await noticeDao.put(report);

    successFlash();

    return redirect(req, res, `/comment/${commentid}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const getCommentsHandler = async (req: Request, res: Response) => {
  try {
    const { parent, lastKey } = req.body;
    const comments = await commentDao.queryByParent(parent, lastKey);

    // Every comment in the page shares this parent, but each records its own parent type, so
    // check each type present (a comment filed under the wrong type can't unlock the thread).
    const types = [...new Set(comments.items.map((comment) => comment.type))];
    const allowed = new Map<string, boolean>();
    for (const type of types) {
      allowed.set(type, await canAccessCommentParent(type, parent, req.user));
    }

    return res.status(200).send({
      success: 'true',
      comments: comments.items.filter((comment) => allowed.get(comment.type)),
      lastKey: comments.lastKey,
    });
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
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

  await commentDao.update(comment);

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

  if (typeof body !== 'string' || typeof parent !== 'string' || typeof mentions !== 'string') {
    return res.status(400).send({
      success: 'false',
      message: 'Invalid comment.',
    });
  }

  if (!(await canAccessCommentParent(type, parent, user, true))) {
    return res.status(404).send({
      success: 'false',
      message: 'The page you are commenting on could not be found.',
    });
  }

  const now = Date.now() - 1000;
  const comment: Omit<Comment, 'id'> = {
    owner: user,
    body: body.substring(0, 5000),
    date: now,
    dateCreated: now,
    dateLastUpdated: now,
    parent: parent.substring(0, 500),
    type,
  };

  const createdComment = await commentDao.createComment(comment);
  const id = createdComment.id;

  if (isNotifiableCommentType(type)) {
    const owner = await getReplyContext[type](parent);
    if (owner) {
      await addNotification(
        owner,
        user,
        `/comment/${id}`,
        `${user?.username} left a comment in response to your ${type}.`,
        { type: NotificationType.COMMENT_REPLY, subject: `${type}:${parent}`, subjectName: type },
      );
    }
  }

  //Front-end joins the mentioned usernames with ; for the Form
  const userMentions: string[] = mentions ? mentions.split(';') : []; //Stupid JS thing where split of empty string is an array of empty string
  for (const mention of userMentions) {
    const mentioned = await userDao.getByUsername(mention);
    if (mentioned) {
      await addNotification(mentioned, user, `/comment/${id}`, `${user?.username} mentioned you in their comment`);
    }
  }

  return res.status(200).send({
    success: 'true',
    comment: {
      ...comment,
      owner: req.user,
      id,
      // req.user is hydrated with .image, which honors an uploaded custom profile image.
      image: req.user?.image ?? getImageData(req.user?.imageName),
    },
  });
};

export const getReplyContext: Record<NotifiableCommentType, (id: string) => Promise<User | undefined>> = {
  comment: async (id) => {
    const comment = await commentDao.getById(id);
    return comment?.owner;
  },
  blog: async (id) => {
    const blog = await blogDao.getById(id);
    return blog?.owner;
  },
  deck: async (id) => {
    const deck = await draftDao.getById(id);
    return deck?.owner;
  },
  article: async (id) => {
    const article = await articleDao.getById(id);
    return article?.owner;
  },
  podcast: async (id) => {
    const podcast = await podcastDao.getById(id);
    return podcast?.owner;
  },
  video: async (id) => {
    const video = await videoDao.getById(id);
    return video?.owner;
  },
  episode: async (id: string) => {
    const episode = await episodeDao.getById(id);
    return episode?.owner;
  },
  package: async (id: string) => {
    const pack = await packageDao.getById(id);
    return pack?.owner;
  },
  record: async (id: string) => {
    const record = await recordDao.getById(id);
    if (!record) {
      return undefined;
    }
    const cube = await cubeDao.getById(record.cube);
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
    handler: [ensureAuth, csrfProtection, reportHandler],
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
