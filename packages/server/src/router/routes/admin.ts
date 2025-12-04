import { ContentStatus } from '@utils/datatypes/Content';
import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import Blog from 'dynamo/models/blog';
import Comment from 'dynamo/models/comment';
import Content from 'dynamo/models/content';
import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import { FeaturedQueue } from 'dynamo/models/featuredQueue';
import Notice from 'dynamo/models/notice';
import User from 'dynamo/models/user';
import { ensureRole, csrfProtection } from 'src/router/middleware';
import sendEmail from 'serverutils/email';
import * as fq from 'serverutils/featuredQueue';
import { render, redirect } from 'serverutils/render';
import { addNotification, getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../types/express';

const ensureAdmin = ensureRole(UserRoles.ADMIN);

export const dashboardHandler = async (req: Request, res: Response) => {
  const noticeCount = await Notice.getByStatus(NoticeStatus.ACTIVE);
  const contentInReview = await Content.getByStatus(ContentStatus.IN_REVIEW);

  return render(req, res, 'AdminDashboardPage', {
    noticeCount: noticeCount.items?.length || 0,
    contentInReview: contentInReview.items?.length || 0,
  });
};

export const commentsHandler = async (req: Request, res: Response) => {
  return redirect(req, res, '/admin/notices');
};

export const reviewContentHandler = async (req: Request, res: Response) => {
  const content = await Content.getByStatus(ContentStatus.IN_REVIEW);
  return render(req, res, 'ReviewContentPage', { content: content.items || [] });
};

export const noticesHandler = async (req: Request, res: Response) => {
  const notices = await Notice.getByStatus(NoticeStatus.ACTIVE);
  return render(req, res, 'NoticePage', { notices: notices.items || [] });
};

export const publishHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid content ID');
    return redirect(req, res, '/admin/reviewcontent');
  }

  const document = await Content.getById(req.params.id);

  if (document.status !== ContentStatus.IN_REVIEW) {
    req.flash('danger', `Content not in review`);
    return redirect(req, res, '/admin/reviewcontent');
  }

  document.status = ContentStatus.PUBLISHED;
  document.date = new Date().valueOf();

  await Content.update(document);

  if (document.owner && req.user) {
    await addNotification(
      document.owner,
      req.user,
      `/content/${document.type}/${document.id}`,
      `${req.user.username} has approved and published your content: ${document.title}`,
    );

    // Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
    const owner = await User.getByIdWithSensitiveData(document.owner.id);

    if (owner) {
      const baseUrl = getBaseUrl();
      await sendEmail(owner.email, 'Your content has been published', 'content_publish', {
        title: document.title,
        url: `${baseUrl}/content/${document.type}/${document.id}`,
      });
    }
  }

  req.flash('success', `Content published: ${document.title}`);

  return redirect(req, res, '/admin/reviewcontent');
};

export const removeReviewHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid content ID');
    return redirect(req, res, '/admin/reviewcontent');
  }

  const document = await Content.getById(req.params.id);

  if (document.status !== ContentStatus.IN_REVIEW) {
    req.flash('danger', `Content not in review`);
    return redirect(req, res, '/admin/reviewcontent');
  }

  document.status = ContentStatus.DRAFT;
  document.date = new Date().valueOf();

  await Content.update(document);

  if (document.owner && req.user) {
    await addNotification(
      document.owner,
      req.user,
      `/content/${document.type}/${document.id}`,
      `${req.user.username} has declined to publish your content: ${document.title}`,
    );

    // Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
    const owner = await User.getByIdWithSensitiveData(document.owner.id);

    if (owner) {
      const baseUrl = getBaseUrl();
      await sendEmail(owner.email, 'Your Content was not published', 'content_decline', {
        title: document.title,
        url: `${baseUrl}/content/${document.type}/${document.id}`,
      });
    }
  }

  req.flash('success', `Content declined: ${document.title}`);

  return redirect(req, res, '/admin/reviewcontent');
};

export const ignoreReportHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid report ID');
    return redirect(req, res, '/admin/notices');
  }

  const report = await Notice.getById(req.params.id);

  report.status = NoticeStatus.PROCESSED;
  await Notice.put(report);

  req.flash('success', 'This report has been ignored.');
  return redirect(req, res, '/admin/notices');
};

export const removeCommentHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid report ID');
    return redirect(req, res, '/admin/notices');
  }

  const report = await Notice.getById(req.params.id);

  if (!report.subject) {
    req.flash('danger', 'Invalid comment ID in report');
    return redirect(req, res, '/admin/notices');
  }

  const comment = await Comment.getById(report.subject);

  if (!comment) {
    req.flash('danger', 'Comment not found');
    return redirect(req, res, '/admin/notices');
  }

  report.status = NoticeStatus.PROCESSED;
  await Notice.put(report);

  // @ts-ignore - Setting owner to undefined to mark comment as deleted
  comment.owner = undefined;
  comment.body = '[removed by moderator]';
  // the -1000 is to prevent weird time display error
  comment.date = Date.now() - 1000;
  await Comment.put(comment);

  req.flash('success', 'This comment has been deleted.');
  return redirect(req, res, '/admin/notices');
};

export const applicationApproveHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid application ID');
    return redirect(req, res, '/admin/notices');
  }

  const application = await Notice.getById(req.params.id);

  if (!application.user) {
    req.flash('danger', 'Invalid application');
    return redirect(req, res, '/admin/notices');
  }

  if (!application.user.roles) {
    application.user.roles = [];
  }
  if (!application.user.roles.includes(UserRoles.CONTENT_CREATOR)) {
    application.user.roles.push(UserRoles.CONTENT_CREATOR);
  }
  await User.update(application.user);

  // Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
  const applicationUser = await User.getByIdWithSensitiveData(application.user.id);

  application.status = NoticeStatus.PROCESSED;
  Notice.put(application);

  if (applicationUser) {
    await sendEmail(applicationUser.email, 'Cube Cobra Content Creator', 'application_approve');
  }

  req.flash('success', `Application for ${application.user.username} approved.`);
  return redirect(req, res, `/admin/notices`);
};

export const applicationDeclineHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid application ID');
    return redirect(req, res, '/admin/notices');
  }

  const application = await Notice.getById(req.params.id);

  if (!application.user) {
    req.flash('danger', 'Invalid application');
    return redirect(req, res, '/admin/notices');
  }

  application.status = NoticeStatus.PROCESSED;
  Notice.put(application);

  // Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
  const applicationUser = await User.getByIdWithSensitiveData(application.user.id);

  if (applicationUser) {
    await sendEmail(applicationUser.email, 'Cube Cobra Content Creator', 'application_decline');
  }

  req.flash('danger', `Application declined.`);
  return redirect(req, res, `/admin/notices`);
};

export const featuredCubesHandler = async (req: Request, res: Response) => {
  let featured: any[] = [];
  let lastkey: Record<string, any> | undefined | null = null;

  do {
    const response = await FeaturedQueue.querySortedByDate(lastkey || undefined);
    featured = featured.concat(response.items || []);
    lastkey = response.lastKey;
  } while (lastkey);

  const cubes = await Cube.batchGet(featured.map((f) => f.cube));
  const sortedCubes = featured.map((f) => cubes.find((c) => c.id === f.cube)).filter((c) => c);

  return render(req, res, 'FeaturedCubesQueuePage', {
    cubes: sortedCubes,
    lastRotation: featured.length > 0 ? featured[0].featuredOn : new Date(0).valueOf(),
  });
};

export const featuredCubesRotateHandler = async (req: Request, res: Response) => {
  const rotate = await fq.rotateFeatured();
  for (const message of rotate.messages) {
    req.flash('danger', message);
  }

  if (rotate.success === 'false') {
    req.flash('danger', 'featured Cube rotation failed!');
    return redirect(req, res, '/admin/featuredcubes');
  }

  const olds = await User.batchGet(rotate.removed.map((f) => f.ownerID));
  const news = await User.batchGet(rotate.added.map((f) => f.ownerID));
  const notifications = [];
  for (const old of olds) {
    notifications.push(
      addNotification(old, req.user || null, '/user/account?nav=patreon', 'Your cube is no longer featured.'),
    );
  }
  for (const newO of news) {
    notifications.push(
      addNotification(newO, req.user || null, '/user/account?nav=patreon', 'Your cube has been featured!'),
    );
  }
  await Promise.all(notifications);
  return redirect(req, res, '/admin/featuredcubes');
};

export const featuredCubesQueueHandler = async (req: Request, res: Response) => {
  if (!req.body.cubeId) {
    req.flash('danger', 'Cube ID not sent');
    return redirect(req, res, '/admin/featuredcubes');
  }
  const cube = await Cube.getById(req.body.cubeId);
  if (!cube) {
    req.flash('danger', 'Cube does not exist');
    return redirect(req, res, '/admin/featuredcubes');
  }

  // @ts-ignore - isPrivate exists on cube but not in type definition
  if (cube.isPrivate) {
    req.flash('danger', 'Cannot feature private cube');
    return redirect(req, res, '/admin/featuredcubes');
  }

  await fq.addNewCubeToQueue(cube.owner.id, cube.id);

  await addNotification(
    cube.owner,
    req.user || null,
    '/user/account?nav=patreon',
    'An admin added your cube to the featured cubes queue.',
  );
  return redirect(req, res, '/admin/featuredcubes');
};

export const banUserHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid notice ID');
      return redirect(req, res, '/admin/notices');
    }

    const notice = await Notice.getById(req.params.id);

    if (!notice.subject) {
      req.flash('danger', 'Invalid user ID in notice');
      return redirect(req, res, '/admin/notices');
    }

    const userToBan = notice.subject;

    let aggregates = {
      commentsWiped: 0,
      cubesDeleted: 0,
      blogPostsDeleted: 0,
      draftsDeleted: 0,
      failed: [],
    };

    // delete all cubes
    const response = await Cube.getByOwner(userToBan);

    aggregates.cubesDeleted += response.items.length;
    for (const cube of response.items) {
      await Cube.deleteById(cube.id);
    }

    // delete all blog posts
    const blogResponse = await Blog.getByOwner(userToBan, 100);

    let lastKey = blogResponse.lastKey;
    let blogIds = blogResponse.items.map((blog) => blog.id);

    while (lastKey) {
      const nextResponse = await Blog.getByOwner(userToBan, 100, lastKey);
      lastKey = nextResponse.lastKey;
      blogIds = blogIds.concat(nextResponse.items.map((blog) => blog.id));
    }

    aggregates.blogPostsDeleted += blogIds.length;
    for (const blogId of blogIds) {
      await Blog.delete(blogId);
    }

    // delete all drafts
    const draftResponse = await Draft.getByOwner(userToBan);

    lastKey = draftResponse.lastEvaluatedKey;
    let draftIds = draftResponse.items.map((draft) => draft.id);

    while (lastKey) {
      const nextResponse = await Draft.getByOwner(userToBan, lastKey);
      lastKey = nextResponse.lastEvaluatedKey;
      draftIds = draftIds.concat(nextResponse.items.map((draft) => draft.id));
    }

    aggregates.draftsDeleted += draftIds.length;
    for (const draftId of draftIds) {
      await Draft.delete(draftId);
    }

    let commentResponse = await Comment.queryByOwner(userToBan);
    let lastkey = commentResponse.lastKey;
    let comments = commentResponse.items || [];

    while (lastkey) {
      const nextResponse = await Comment.queryByOwner(userToBan, lastkey);
      lastkey = nextResponse.lastKey;
      comments = comments.concat(nextResponse.items || []);
    }

    // delete all comments
    aggregates.commentsWiped += comments.length;

    for (const comment of comments) {
      // @ts-ignore - Setting owner to undefined to mark as deleted
      comment.owner = undefined;
      comment.body = '[deleted]';

      await Comment.put(comment);
    }

    // ban user
    const user = await User.getById(userToBan);

    if (!user) {
      throw new Error('User not found');
    }

    user.roles = [UserRoles.BANNED];
    user.about = '[deleted]';

    await User.put(user);

    notice.status = NoticeStatus.PROCESSED;
    await Notice.put(notice);

    req.flash(
      'success',
      `User ${userToBan} has been banned. ${aggregates.cubesDeleted} cubes, ${aggregates.blogPostsDeleted} blog posts, ${aggregates.draftsDeleted} drafts, and ${aggregates.commentsWiped} comments were deleted.`,
    );
    return redirect(req, res, '/admin/notices');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    req.flash('danger', errorMessage);
    return redirect(req, res, '/admin/notices');
  }
};

export const featuredCubesUnqueueHandler = async (req: Request, res: Response) => {
  if (!req.body.cubeId) {
    req.flash('danger', 'Cube ID not sent');
    return redirect(req, res, '/admin/featuredcubes');
  }

  const queuedCube = await FeaturedQueue.getByCube(req.body.cubeId);

  if (!queuedCube) {
    req.flash('danger', 'Cube not found in featured queue');
    return redirect(req, res, '/admin/featuredcubes');
  }

  await FeaturedQueue.delete(req.body.cubeId);

  const user = await User.getById(queuedCube.owner);
  if (user && req.user) {
    await addNotification(
      user,
      req.user,
      '/user/account?nav=patreon',
      'An admin removed your cube from the featured cubes queue.',
    );
  }
  return redirect(req, res, '/admin/featuredcubes');
};

export const routes = [
  {
    path: '/dashboard',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, dashboardHandler],
  },
  {
    path: '/comments',
    method: 'get',
    handler: [csrfProtection, commentsHandler],
  },
  {
    path: '/reviewcontent',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, reviewContentHandler],
  },
  {
    path: '/notices',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, noticesHandler],
  },
  {
    path: '/publish/:id',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, publishHandler],
  },
  {
    path: '/removereview/:id',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, removeReviewHandler],
  },
  {
    path: '/ignorereport/:id',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, ignoreReportHandler],
  },
  {
    path: '/removecomment/:id',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, removeCommentHandler],
  },
  {
    path: '/application/approve/:id',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, applicationApproveHandler],
  },
  {
    path: '/application/decline/:id',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, applicationDeclineHandler],
  },
  {
    path: '/featuredcubes',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, featuredCubesHandler],
  },
  {
    path: '/featuredcubes/rotate',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, featuredCubesRotateHandler],
  },
  {
    path: '/featuredcubes/queue',
    method: 'post',
    handler: [csrfProtection, ensureAdmin, featuredCubesQueueHandler],
  },
  {
    path: '/banuser/:id',
    method: 'get',
    handler: [csrfProtection, ensureAdmin, banUserHandler],
  },
  {
    path: '/featuredcubes/unqueue',
    method: 'post',
    handler: [csrfProtection, ensureAdmin, featuredCubesUnqueueHandler],
  },
];
