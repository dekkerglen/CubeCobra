// Load Environment Variables
import { ContentStatus } from '@utils/datatypes/Content';
import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { commentDao } from 'dynamo/daos';
import Blog from 'dynamo/models/blog';
import Content from 'dynamo/models/content';
import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import FeaturedQueue from 'dynamo/models/featuredQueue';
import Notice from 'dynamo/models/notice';
import User from 'dynamo/models/user';
import express from 'express';

import 'dotenv/config';

import sendEmail from '../serverutils/email';
import fq from '../serverutils/featuredQueue';
import { redirect, render } from '../serverutils/render';
import util from '../serverutils/util';
import { Request, Response } from '../types/express';
import { csrfProtection, ensureRole } from './middleware';

const ensureAdmin = ensureRole(UserRoles.ADMIN);

const router = express.Router();

router.use(csrfProtection);

router.get('/dashboard', ensureAdmin, async (req: Request, res: Response) => {
  const noticeCount = await Notice.getByStatus(NoticeStatus.ACTIVE);
  const contentInReview = await Content.getByStatus(ContentStatus.IN_REVIEW);

  return render(req, res, 'AdminDashboardPage', {
    noticeCount: noticeCount.items?.length || 0,
    contentInReview: contentInReview.items?.length || 0,
  });
});

router.get('/comments', async (req: Request, res: Response) => {
  return redirect(req, res, '/admin/notices');
});

router.get('/reviewcontent', ensureAdmin, async (req: Request, res: Response) => {
  const content = await Content.getByStatus(ContentStatus.IN_REVIEW);
  return render(req, res, 'ReviewContentPage', { content: content.items });
});

router.get('/notices', ensureAdmin, async (req: Request, res: Response) => {
  const notices = await Notice.getByStatus(NoticeStatus.ACTIVE);
  return render(req, res, 'NoticePage', { notices: notices.items });
});

router.get('/publish/:id', ensureAdmin, async (req: Request, res: Response) => {
  const document = await Content.getById(req.params.id!);

  if (document.status !== ContentStatus.IN_REVIEW) {
    req.flash('danger', `Content not in review`);
    return redirect(req, res, '/admin/reviewcontent');
  }

  document.status = ContentStatus.PUBLISHED;
  document.date = new Date().valueOf();

  await Content.update(document);

  if (document.owner && req.user) {
    await util.addNotification(
      document.owner,
      req.user,
      `/content/${document.type}/${document.id}`,
      `${req.user.username} has approved and published your content: ${document.title}`,
    );

    //Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
    const owner = await User.getByIdWithSensitiveData(document.owner.id);

    if (owner) {
      const baseUrl = util.getBaseUrl();
      await sendEmail(owner.email, 'Your content has been published', 'content_publish', {
        title: document.title,
        url: `${baseUrl}/content/${document.type}/${document.id}`,
      });
    }
  }

  req.flash('success', `Content published: ${document.title}`);

  return redirect(req, res, '/admin/reviewcontent');
});

router.get('/removereview/:id', ensureAdmin, async (req: Request, res: Response) => {
  const document = await Content.getById(req.params.id!);

  if (document.status !== ContentStatus.IN_REVIEW) {
    req.flash('danger', `Content not in review`);
    return redirect(req, res, '/admin/reviewcontent');
  }

  document.status = ContentStatus.DRAFT;
  document.date = new Date().valueOf();

  await Content.update(document);

  if (document.owner && req.user) {
    await util.addNotification(
      document.owner,
      req.user,
      `/content/${document.type}/${document.id}`,
      `${req.user.username} has declined to publish your content: ${document.title}`,
    );

    //Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
    const owner = await User.getByIdWithSensitiveData(document.owner.id);

    if (owner) {
      const baseUrl = util.getBaseUrl();
      await sendEmail(owner.email, 'Your Content was not published', 'content_decline', {
        title: document.title,
        url: `${baseUrl}/content/${document.type}/${document.id}`,
      });
    }
  }

  req.flash('success', `Content declined: ${document.title}`);

  return redirect(req, res, '/admin/reviewcontent');
});

router.get('/ignorereport/:id', ensureAdmin, async (req: Request, res: Response) => {
  const report = await Notice.getById(req.params.id!);

  report.status = NoticeStatus.PROCESSED;
  await Notice.put(report);

  req.flash('success', 'This report has been ignored.');
  return redirect(req, res, '/admin/notices');
});

router.get('/removecomment/:id', ensureAdmin, async (req: Request, res: Response) => {
  const report = await Notice.getById(req.params.id!);
  const comment = await commentDao.getById(report.subject!);

  report.status = NoticeStatus.PROCESSED;
  await Notice.put(report);

  if (comment) {
    comment.owner = undefined;
    comment.body = '[removed by moderator]';
    // the -1000 is to prevent weird time display error
    comment.date = Date.now() - 1000;
    await commentDao.put(comment);
  }

  req.flash('success', 'This comment has been deleted.');
  return redirect(req, res, '/admin/notices');
});

router.get('/application/approve/:id', ensureAdmin, async (req: Request, res: Response) => {
  const application = await Notice.getById(req.params.id!);

  if (!application.user.roles) {
    application.user.roles = [];
  }
  if (!application.user.roles.includes(UserRoles.CONTENT_CREATOR)) {
    application.user.roles.push(UserRoles.CONTENT_CREATOR);
  }
  await User.update(application.user);

  //Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
  const applicationUser = await User.getByIdWithSensitiveData(application.user.id);

  application.status = NoticeStatus.PROCESSED;
  Notice.put(application);

  if (applicationUser) {
    await sendEmail(applicationUser.email, 'Cube Cobra Content Creator', 'application_approve');
  }

  req.flash('success', `Application for ${application.user.username} approved.`);
  return redirect(req, res, `/admin/notices`);
});

router.get('/application/decline/:id', ensureAdmin, async (req: Request, res: Response) => {
  const application = await Notice.getById(req.params.id!);

  application.status = NoticeStatus.PROCESSED;
  Notice.put(application);

  //Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
  const applicationUser = await User.getByIdWithSensitiveData(application.user.id);

  if (applicationUser) {
    await sendEmail(applicationUser.email, 'Cube Cobra Content Creator', 'application_decline');
  }

  req.flash('danger', `Application declined.`);
  return redirect(req, res, `/admin/notices`);
});

router.get('/featuredcubes', ensureAdmin, async (req: Request, res: Response) => {
  let featured: any[] = [];
  let lastkey: Record<string, any> | null | undefined = null;

  do {
    const response = await FeaturedQueue.querySortedByDate(lastkey || undefined);
    featured = featured.concat(response.items);
    lastkey = response.lastKey;
  } while (lastkey);

  const cubes = await Cube.batchGet(featured.map((f: any) => f.cube));
  const sortedCubes = featured
    .map((f: any) => cubes.find((c: any) => c.id === f.cube))
    .filter((c): c is NonNullable<typeof c> => c !== undefined && c !== null);

  return render(req, res, 'FeaturedCubesQueuePage', {
    cubes: sortedCubes,
    lastRotation: featured.length > 0 ? featured[0].featuredOn : new Date(0).valueOf(),
  });
});

router.get('/featuredcubes/rotate', ensureAdmin, async (req: Request, res: Response) => {
  const rotate = await fq.rotateFeatured();
  for (const message of rotate.messages) {
    req.flash('danger', message);
  }

  if (rotate.success === 'false') {
    req.flash('danger', 'featured Cube rotation failed!');
    return redirect(req, res, '/admin/featuredcubes');
  }

  const olds = await User.batchGet(rotate.removed.map((f: any) => f.ownerID));
  const news = await User.batchGet(rotate.added.map((f: any) => f.ownerID));
  const notifications = [];
  if (req.user) {
    for (const old of olds) {
      notifications.push(
        util.addNotification(old, req.user, '/user/account?nav=patreon', 'Your cube is no longer featured.'),
      );
    }
    for (const newO of news) {
      notifications.push(
        util.addNotification(newO, req.user, '/user/account?nav=patreon', 'Your cube has been featured!'),
      );
    }
  }
  await Promise.all(notifications);
  return redirect(req, res, '/admin/featuredcubes');
});

router.post('/featuredcubes/queue', ensureAdmin, async (req: Request, res: Response) => {
  if (!req.body.cubeId) {
    req.flash('danger', 'Cube ID not sent');
    return redirect(req, res, '/admin/featuredcubes');
  }
  const cube = await Cube.getById(req.body.cubeId);
  if (!cube) {
    req.flash('danger', 'Cube does not exist');
    return redirect(req, res, '/admin/featuredcubes');
  }

  if (cube.isPrivate) {
    req.flash('danger', 'Cannot feature private cube');
    return redirect(req, res, '/admin/featuredcubes');
  }

  await fq.addNewCubeToQueue(cube.owner.id, cube.id);

  if (req.user) {
    await util.addNotification(
      cube.owner,
      req.user,
      '/user/account?nav=patreon',
      'An admin added your cube to the featured cubes queue.',
    );
  }
  return redirect(req, res, '/admin/featuredcubes');
});

router.get('/banuser/:id', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const notice = await Notice.getById(req.params.id!);
    const userToBan = notice.subject;

    const aggregates = {
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
    const blogResponse = await Blog.getByOwner(userToBan!, 100);

    let lastKey = blogResponse.lastKey;
    let blogIds = blogResponse.items.map((blog) => blog.id);

    while (lastKey) {
      const nextResponse = await Blog.getByOwner(userToBan!, 100, lastKey);
      lastKey = nextResponse.lastKey;
      blogIds = blogIds.concat(nextResponse.items.map((blog) => blog.id));
    }

    aggregates.blogPostsDeleted += blogIds.length;
    for (const blogId of blogIds) {
      await Blog.delete(blogId);
    }

    // delete all drafts
    const draftResponse = await Draft.getByOwner(userToBan!);

    lastKey = draftResponse.lastEvaluatedKey;
    let draftIds = draftResponse.items.map((draft: any) => draft.id);

    while (lastKey) {
      const nextResponse = await Draft.getByOwner(userToBan!, lastKey, 100);
      lastKey = nextResponse.lastEvaluatedKey;
      draftIds = draftIds.concat(nextResponse.items.map((draft: any) => draft.id));
    }

    aggregates.draftsDeleted += draftIds.length;
    for (const draftId of draftIds) {
      await Draft.delete(draftId);
    }

    const commentResponse = await commentDao.queryByOwner(userToBan!);
    let lastkey = commentResponse.lastKey;
    let comments = commentResponse.items || [];

    while (lastkey) {
      const nextResponse = await commentDao.queryByOwner(userToBan!, lastkey);
      lastkey = nextResponse.lastKey;
      comments = comments.concat(nextResponse.items || []);
    }

    // delete all comments
    aggregates.commentsWiped += comments.length;

    for (const comment of comments) {
      comment.owner = undefined;
      comment.body = '[deleted]';

      await commentDao.put(comment);
    }

    // ban user
    const user = await User.getById(userToBan!);

    if (user) {
      user.roles = [UserRoles.BANNED];
      user.about = '[deleted]';

      await User.put(user);
    }

    notice.status = NoticeStatus.PROCESSED;
    await Notice.put(notice);

    req.flash(
      'success',
      `User ${userToBan} has been banned. ${aggregates.cubesDeleted} cubes, ${aggregates.blogPostsDeleted} blog posts, ${aggregates.draftsDeleted} drafts, and ${aggregates.commentsWiped} comments were deleted.`,
    );
    return redirect(req, res, '/admin/notices');
  } catch (err) {
    const error = err as Error;
    req.flash('danger', error.message);
    return redirect(req, res, '/admin/notices');
  }
});

router.post('/featuredcubes/unqueue', ensureAdmin, async (req: Request, res: Response) => {
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
    await util.addNotification(
      user,
      req.user,
      '/user/account?nav=patreon',
      'An admin removed your cube from the featured cubes queue.',
    );
  }
  return redirect(req, res, '/admin/featuredcubes');
});

export default router;
