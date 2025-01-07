// Load Environment Variables
require('dotenv').config();

const express = require('express');
const { body } = require('express-validator');
const mailer = require('nodemailer');
const path = require('path');
const Email = require('email-templates');
const { ensureRole, csrfProtection, flashValidationErrors } = require('./middleware');

const User = require('../dynamo/models/user');
const Notice = require('../dynamo/models/notice');
const Comment = require('../dynamo/models/comment');
const Blog = require('../dynamo/models/blog');
const Draft = require('../dynamo/models/draft');
const Content = require('../dynamo/models/content');
const FeaturedQueue = require('../dynamo/models/featuredQueue');
const Cube = require('../dynamo/models/cube');
const { render, redirect } = require('../util/render');
const util = require('../util/util');
const fq = require('../util/featuredQueue');

const ensureAdmin = ensureRole('Admin');

const router = express.Router();

router.use(csrfProtection);

router.get('/dashboard', ensureAdmin, async (req, res) => {
  const noticeCount = await Notice.getByStatus(Notice.STATUS.ACTIVE);
  const contentInReview = await Content.getByStatus(Content.STATUS.IN_REVIEW);

  return render(req, res, 'AdminDashboardPage', {
    noticeCount: noticeCount.items.length,
    contentInReview: contentInReview.items.length,
  });
});

router.get('/comments', async (req, res) => {
  return redirect(req, res, '/admin/notices');
});

router.get('/reviewcontent', ensureAdmin, async (req, res) => {
  const content = await Content.getByStatus(Content.STATUS.IN_REVIEW);
  return render(req, res, 'ReviewContentPage', { content: content.items });
});

router.get('/notices', ensureAdmin, async (req, res) => {
  const notices = await Notice.getByStatus(Notice.STATUS.ACTIVE);
  return render(req, res, 'NoticePage', { notices: notices.items });
});

router.get('/publish/:id', ensureAdmin, async (req, res) => {
  const document = await Content.getById(req.params.id);

  if (document.status !== Content.STATUS.IN_REVIEW) {
    req.flash('danger', `Content not in review`);
    return redirect(req, res, '/admin/reviewcontent');
  }

  document.status = Content.STATUS.PUBLISHED;
  document.date = new Date().valueOf();

  await Content.update(document);

  if (document.owner) {
    await util.addNotification(
      document.owner,
      req.user,
      `/content/${document.type}/${document.id}`,
      `${req.user.username} has approved and published your content: ${document.title}`,
    );
  }

  const smtpTransport = mailer.createTransport({
    name: 'CubeCobra.com',
    secure: true,
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_CONFIG_USERNAME,
      pass: process.env.EMAIL_CONFIG_PASSWORD,
    },
  });

  const message = new Email({
    message: {
      from: 'Cube Cobra Team <support@cubecobra.com>',
      to: document.owner.email,
      subject: 'Your content has been published',
    },
    send: true,
    juiceResources: {
      webResources: {
        relativeTo: path.join(__dirname, '..', 'public'),
        images: true,
      },
    },
    transport: smtpTransport,
  });

  message.send({
    template: 'content_publish',
    locals: {
      title: document.title,
      url: `https://cubecobra.com/content/${document.type}/${document.id}`,
    },
  });

  req.flash('success', `Content published: ${document.title}`);

  return redirect(req, res, '/admin/reviewcontent');
});

router.get('/removereview/:id', ensureAdmin, async (req, res) => {
  const document = await Content.getById(req.params.id);

  if (document.status !== Content.STATUS.IN_REVIEW) {
    req.flash('danger', `Content not in review`);
    return redirect(req, res, '/admin/reviewcontent');
  }

  document.status = Content.STATUS.DRAFT;
  document.date = new Date().valueOf();

  await Content.update(document);

  if (document.owner) {
    await util.addNotification(
      document.owner,
      req.user,
      `/content/${document.type}/${document.id}`,
      `${req.user.username} has declined to publish your content: ${document.title}`,
    );
  }

  const smtpTransport = mailer.createTransport({
    name: 'CubeCobra.com',
    secure: true,
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_CONFIG_USERNAME,
      pass: process.env.EMAIL_CONFIG_PASSWORD,
    },
  });

  const message = new Email({
    message: {
      from: 'Cube Cobra Team <support@cubecobra.com>',
      to: document.owner.email,
      subject: 'Your Content was not published',
    },
    send: true,
    juiceResources: {
      webResources: {
        relativeTo: path.join(__dirname, '..', 'public'),
        images: true,
      },
    },
    transport: smtpTransport,
  });

  await message.send({
    template: 'content_decline',
    locals: {
      title: document.title,
      url: `https://cubecobra.com/content/${document.type}/${document.id}`,
    },
  });

  req.flash('success', `Content declined: ${document.title}`);

  return redirect(req, res, '/admin/reviewcontent');
});

router.get('/ignorereport/:id', ensureAdmin, async (req, res) => {
  const report = await Notice.getById(req.params.id);

  report.status = Notice.STATUS.PROCESSED;
  await Notice.put(report);

  req.flash('success', 'This report has been ignored.');
  return redirect(req, res, '/admin/notices');
});

router.get('/removecomment/:id', ensureAdmin, async (req, res) => {
  const report = await Notice.getById(req.params.id);
  const comment = await Comment.getById(report.subject);

  report.status = Notice.STATUS.PROCESSED;
  await Notice.put(report);

  comment.owner = null;
  comment.body = '[removed by moderator]';
  // the -1000 is to prevent weird time display error
  comment.date = Date.now() - 1000;
  await Comment.put(comment);

  req.flash('success', 'This comment has been deleted.');
  return redirect(req, res, '/admin/notices');
});

router.get('/application/approve/:id', ensureAdmin, async (req, res) => {
  const application = await Notice.getById(req.params.id);

  if (!application.user.roles) {
    application.user.roles = [];
  }
  if (!application.user.roles.includes(User.ROLES.CONTENT_CREATOR)) {
    application.user.roles.push(User.ROLES.CONTENT_CREATOR);
  }
  await User.update(application.user);

  application.status = Notice.STATUS.PROCESSED;
  Notice.put(application);

  const smtpTransport = mailer.createTransport({
    name: 'CubeCobra.com',
    secure: true,
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_CONFIG_USERNAME,
      pass: process.env.EMAIL_CONFIG_PASSWORD,
    },
  });

  const message = new Email({
    message: {
      from: 'Cube Cobra Team <support@cubecobra.com>',
      to: application.user.email,
      subject: 'Cube Cobra Content Creator',
    },
    send: true,
    juiceResources: {
      webResources: {
        relativeTo: path.join(__dirname, '..', 'public'),
        images: true,
      },
    },
    transport: smtpTransport,
  });

  await message.send({
    template: 'application_approve',
    locals: {},
  });

  req.flash('success', `Application for ${application.user.username} approved.`);
  return redirect(req, res, `/admin/notices`);
});

router.get('/application/decline/:id', ensureAdmin, async (req, res) => {
  const application = await Notice.getById(req.params.id);

  application.status = Notice.STATUS.PROCESSED;
  Notice.put(application);

  const smtpTransport = mailer.createTransport({
    name: 'CubeCobra.com',
    secure: true,
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_CONFIG_USERNAME,
      pass: process.env.EMAIL_CONFIG_PASSWORD,
    },
  });

  const message = new Email({
    message: {
      from: 'Cube Cobra Team <support@cubecobra.com>',
      to: application.user.email,
      subject: 'Cube Cobra Content Creator',
    },
    send: true,
    juiceResources: {
      webResources: {
        relativeTo: path.join(__dirname, '..', 'public'),
        images: true,
      },
    },
    transport: smtpTransport,
  });

  await message.send({
    template: 'application_decline',
    locals: {},
  });

  req.flash('danger', `Application declined.`);
  return redirect(req, res, `/admin/notices`);
});

router.get('/featuredcubes', ensureAdmin, async (req, res) => {
  const featured = await FeaturedQueue.querySortedByDate(null, 10000);
  const cubes = await Cube.batchGet(featured.items.map((f) => f.cube));
  const sortedCubes = featured.items.map((f) => cubes.find((c) => c.id === f.cube)).filter((c) => c);

  return render(req, res, 'FeaturedCubesQueuePage', {
    cubes: sortedCubes,
    featured,
    lastRotation: featured.items[0].featuredOn,
  });
});

router.post('/featuredcubes/rotate', ensureAdmin, async (req, res) => {
  const queue = await FeaturedQueue.querySortedByDate();
  const { items } = queue;

  const rotate = await fq.rotateFeatured(items);
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
      util.addNotification(old, req.user, '/user/account?nav=patreon', 'Your cube is no longer featured.'),
    );
  }
  for (const newO of news) {
    notifications.push(
      util.addNotification(newO, req.user, '/user/account?nav=patreon', 'Your cube has been featured!'),
    );
  }
  await Promise.all(notifications);
  return redirect(req, res, '/admin/featuredcubes');
});

router.post(
  '/featuredcubes/setperiod',
  ensureAdmin,
  util.wrapAsyncApi(async (req, res) => {
    const days = Number.parseInt(req.body.days, 10);
    if (!Number.isInteger(days)) {
      return res.status(400).send({
        success: 'false',
        message: 'Days between rotations must be an integer',
      });
    }

    await fq.updateFeatured(async (featured) => {
      featured.daysBetweenRotations = days;
    });
    return res.send({ success: 'true', period: days });
  }),
);

router.post('/featuredcubes/queue', ensureAdmin, async (req, res) => {
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

  const update = await fq.updateFeatured(async (featured) => {
    const index = featured.queue.findIndex((c) => c.cubeID.equals(cube.id));
    if (index !== -1) {
      throw new Error('Cube is already in queue');
    }
    featured.queue.push({ cubeID: cube.id, ownerID: cube.owner.id });
  });

  if (!update.ok) {
    req.flash('danger', update.message);
    return redirect(req, res, '/admin/featuredcubes');
  }

  await util.addNotification(
    cube.owner,
    req.user,
    '/user/account?nav=patreon',
    'An admin added your cube to the featured cubes queue.',
  );
  return redirect(req, res, '/admin/featuredcubes');
});

router.get('/banuser/:id', ensureAdmin, async (req, res) => {
  try {
    const notice = await Notice.getById(req.params.id);
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
    const blogResponse = await Blog.getByOwner(userToBan);

    let lastKey = blogResponse.LastEvaluatedKey;
    let blogIds = blogResponse.items.map((blog) => blog.id);

    while (lastKey) {
      const nextResponse = await Blog.getByOwner(userToBan, 100, lastKey);
      lastKey = nextResponse.LastEvaluatedKey;
      blogIds = blogIds.concat(nextResponse.items.map((blog) => blog.id));
    }

    aggregates.blogPostsDeleted += blogIds.length;
    for (const blogId of blogIds) {
      await Blog.delete(blogId);
    }

    // delete all drafts
    const draftResponse = await Draft.getByOwner(userToBan);

    lastKey = draftResponse.LastEvaluatedKey;
    let draftIds = draftResponse.items.map((draft) => draft.id);

    while (lastKey) {
      const nextResponse = await Draft.getByOwner(userToBan, 100, lastKey);
      lastKey = nextResponse.LastEvaluatedKey;
      draftIds = draftIds.concat(nextResponse.items.map((draft) => draft.id));
    }

    aggregates.draftsDeleted += draftIds.length;
    for (const draftId of draftIds) {
      await Draft.delete(draftId);
    }

    commentResponse = await Comment.queryByOwner(userToBan);
    lastkey = commentResponse.LastEvaluatedKey;
    comments = commentResponse.items;

    while (lastKey) {
      const nextResponse = await Comment.queryByOwner(userToBan, lastKey);
      lastKey = nextResponse.LastEvaluatedKey;
      comments = comments.concat(nextResponse.items);
    }

    // delete all comments
    aggregates.commentsWiped += comments.length;

    for (const comment of comments) {
      delete comment.owner;
      comment.body = '[deleted]';
    
      await Comment.put(comment);
    }

    // ban user
    const user = await User.getById(userToBan);

    user.roles = ['Banned'];
    user.about = '[deleted]';

    await User.put(user);

    notice.status = Notice.STATUS.PROCESSED;
    await Notice.put(notice);

    req.flash(
      'success',
      `User ${userToBan} has been banned. ${aggregates.cubesDeleted} cubes, ${aggregates.blogPostsDeleted} blog posts, ${aggregates.draftsDeleted} drafts, and ${aggregates.commentsWiped} comments were deleted.`,
    );
    return redirect(req, res, '/admin/notices');
  } catch (err) {
    req.flash('danger', err.message);
    return redirect(req, res, '/admin/notices');
  }
});

router.post('/featuredcubes/unqueue', ensureAdmin, async (req, res) => {
  if (!req.body.cubeId) {
    req.flash('Cube ID not sent');
    return redirect(req, res, '/admin/featuredcubes');
  }

  const update = await fq.updateFeatured(async (featured) => {
    const index = featured.queue.findIndex((c) => c.cubeID.equals(req.body.cubeId));
    if (index === -1) {
      throw new Error('Cube not found in queue');
    }
    if (index < 2) {
      throw new Error('Cannot remove currently featured cube from queue');
    }
    return featured.queue.splice(index, 1);
  });
  if (!update.ok) {
    req.flash('danger', update.message);
    return redirect(req, res, '/admin/featuredcubes');
  }

  const [removed] = update.return;
  const user = await User.getById(removed.ownerID);
  await util.addNotification(
    user,
    req.user,
    '/user/account?nav=patreon',
    'An admin removed your cube from the featured cubes queue.',
  );
  return redirect(req, res, '/admin/featuredcubes');
});

router.post(
  '/featuredcubes/move',
  ensureAdmin,
  body('cubeId', 'Cube ID must be sent').not().isEmpty(),
  body('from', 'Cannot move currently featured cube').isInt({ gt: 2 }).toInt(),
  body('to', 'Cannot move cube to featured position').isInt({ gt: 2 }).toInt(),
  flashValidationErrors,
  async (req, res) => {
    if (!req.validated) return redirect(req, res, '/admin/featuredcubes');
    let { from, to } = req.body;
    // indices are sent in human-readable form (indexing from 1)
    from -= 1;
    to -= 1;

    const update = await fq.updateFeatured(async (featured) => {
      if (featured.queue.length <= from || !featured.queue[from].cubeID.equals(req.body.cubeId))
        throw new Error('Cube is not at expected position in queue');
      if (featured.queue.length <= to) throw new Error('Target position is higher than cube length');
      const [spliced] = featured.queue.splice(from, 1);
      featured.queue.splice(to, 0, spliced);
    });

    if (!update.ok) req.flash('danger', update.message);
    else req.flash('success', 'Successfully moved cube');

    return redirect(req, res, '/admin/featuredcubes');
  },
);

module.exports = router;
