// Load Environment Variables
require('dotenv').config();

const express = require('express');
const { ensureAuth, ensureRole, csrfProtection } = require('./middleware');
const { render } = require('../serverjs/render');
const Application = require('../models/application');
const Article = require('../models/article');
const Video = require('../models/video');

const PAGE_SIZE = 24;

const ensureContentCreator = ensureRole('ContentCreator');

const router = express.Router();

router.use(csrfProtection);

router.get('/application', ensureAuth, async (req, res) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to apply to be a content creator partner.');
    return render(req, res, 'ContactPage');
  }
  return render(req, res, 'ApplicationPage');
});

router.post('/submitapplication', ensureAuth, async (req, res) => {
  try {
    if (!req.user) {
      req.flash('danger', 'Please log in to apply to be a content creator partner.');
      return render(req, res, 'ContactPage');
    }
    const application = new Application();

    application.userid = req.user.id;
    application.info = req.body.info;
    application.timePosted = new Date();

    await application.save();

    req.flash('success', 'Your application has been submitted. We will reach out via email when a decision is made.');
    return render(req, res, 'ApplicationPage');
  } catch (err) {
    req.flash('danger', 'Please log in to apply to be a content creator partner.');
    return render(req, res, 'ApplicationPage');
  }
});

router.get('/creators', ensureContentCreator, async (req, res) => {
  return render(req, res, 'CreatorsPage');
});

router.get('/browse', async (req, res) => {});

router.get('/articles', async (req, res) => {
  return res.redirect('/content/articles/0');
});

router.get('/articles/:page', async (req, res) => {
  const count = await Article.countDocuments();
  const articles = await Article.find({ status: 'published' })
    .sort({ date: -1 })
    .skip(req.params.page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return render(req, res, 'ArticlesPage', { articles, count, page: req.params.page });
});

router.get('/podcasts', async (req, res) => {});

router.get('/videos', async (req, res) => {
  res.redirect('/content/videos/0');
});

router.get('/videos/:page', async (req, res) => {
  const count = await Video.countDocuments();
  const videos = await Video.find({ status: 'published' })
    .sort({ date: -1 })
    .skip(req.params.page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return render(req, res, 'VideosPage', { videos, count, page: req.params.page });
});

router.get('/article/:id', async (req, res) => {
  const article = await Article.findById(req.params.id);

  if (!article) {
    req.flash('danger', 'Article not found');
    res.redirect('/content/browse');
  }

  return render(req, res, 'ArticlePage', { article });
});

router.get('/podcast/:id', async (req, res) => {});

router.get('/video/:id', async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    req.flash('danger', 'Video not found');
    res.redirect('/content/browse');
  }

  return render(req, res, 'VideoPage', { video });
});

router.get('/article/edit/:id', ensureContentCreator, async (req, res) => {
  const article = await Article.findById(req.params.id);

  if (!article) {
    req.flash('danger', 'Article not found');
    res.redirect('/404');
  }

  if (article.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    res.redirect(`/content/article/${article._id}`);
  }

  if (article.status === 'published') {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    res.redirect(`/content/article/${article._id}`);
  }

  return render(req, res, 'EditArticlePage', { article });
});

router.get('/video/edit/:id', ensureContentCreator, async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    req.flash('danger', 'Video not found');
    res.redirect('/404');
  }

  if (video.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    res.redirect(`/content/video/${video._id}`);
  }

  if (video.status === 'published') {
    req.flash('danger', 'Unauthorized: Videos cannot be editted after being published.');
    res.redirect(`/content/video/${video._id}`);
  }

  return render(req, res, 'EditVideoPage', { video });
});

router.post('/editarticle', ensureContentCreator, async (req, res) => {
  const { articleid, title, image, imagename, artist, body } = req.body;

  const article = await Article.findById(articleid);

  if (article.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    res.redirect(`/content/article/${article._id}`);
  }

  if (article.status === 'published') {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    res.redirect(`/content/article/${article._id}`);
  }

  article.title = title.substring(0, 1000);
  article.image = image.substring(0, 1000);
  article.imagename = imagename.substring(0, 1000);
  article.artist = artist.substring(0, 1000);
  article.body = body.substring(0, 1000000);

  await article.save();

  res.redirect(`/content/article/edit/${article._id}`);
});

router.post('/editvideo', ensureContentCreator, async (req, res) => {
  const { videoid, title, image, imagename, artist, body, url } = req.body;

  const video = await Video.findById(videoid);

  if (video.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    res.redirect(`/content/video/${video._id}`);
  }

  if (video.status === 'published') {
    req.flash('danger', 'Unauthorized: videos cannot be editted after being published.');
    res.redirect(`/content/video/${video._id}`);
  }

  video.title = title.substring(0, 1000);
  video.image = image.substring(0, 1000);
  video.imagename = imagename.substring(0, 1000);
  video.artist = artist.substring(0, 1000);
  video.url = url.substring(0, 1000);
  video.body = body.substring(0, 1000000);

  await video.save();

  res.redirect(`/content/video/edit/${video._id}`);
});

router.post('/submitarticle', ensureContentCreator, async (req, res) => {
  const { articleid, title, image, imagename, artist, body } = req.body;

  const article = await Article.findById(articleid);

  if (article.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    res.redirect(`/content/article/${article._id}`);
  }

  if (article.status === 'published') {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    res.redirect(`/content/article/${article._id}`);
  }

  article.title = title.substring(0, 1000);
  article.image = image.substring(0, 1000);
  article.imagename = imagename.substring(0, 1000);
  article.artist = artist.substring(0, 1000);
  article.body = body.substring(0, 1000000);
  article.status = 'inReview';

  await article.save();
  req.flash(
    'success',
    'Your article has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  res.redirect(`/content/article/edit/${article._id}`);
});

router.post('/submitvideo', ensureContentCreator, async (req, res) => {
  const { videoid, title, image, imagename, artist, body, url } = req.body;

  const video = await Video.findById(videoid);

  if (video.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    res.redirect(`/content/video/${video._id}`);
  }

  if (video.status === 'published') {
    req.flash('danger', 'Unauthorized: videos cannot be editted after being published.');
    res.redirect(`/content/video/${video._id}`);
  }

  video.title = title.substring(0, 1000);
  video.image = image.substring(0, 1000);
  video.imagename = imagename.substring(0, 1000);
  video.artist = artist.substring(0, 1000);
  video.url = url.substring(0, 1000);
  video.body = body.substring(0, 1000000);
  video.status = 'inReview';

  await video.save();
  req.flash(
    'success',
    'Your video has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  res.redirect(`/content/video/edit/${video._id}`);
});

router.get('/newarticle', ensureContentCreator, async (req, res) => {
  const article = new Article();

  article.title = 'New Article';
  article.body = '';
  article.owner = req.user.id;
  article.date = new Date();
  article.image =
    'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/d/e/decb78dd-03d7-43a0-8ff5-1b97c6f515c9.jpg?1580015192';
  article.artist = 'Craig J Spearing';
  article.imagename = 'emmessi tome [mb1-1579]';
  article.status = 'draft';
  article.username = req.user.username;

  await article.save();

  res.redirect(`/content/article/edit/${article._id}`);
});

router.get('/newvideo', ensureContentCreator, async (req, res) => {
  const video = new Video();

  video.title = 'New Video';
  video.body = '';
  video.url = '';
  video.owner = req.user.id;
  video.date = new Date();
  video.image =
    'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/d/e/decb78dd-03d7-43a0-8ff5-1b97c6f515c9.jpg?1580015192';
  video.artist = 'Craig J Spearing';
  video.imagename = 'emmessi tome [mb1-1579]';
  video.status = 'draft';
  video.username = req.user.username;

  await video.save();

  res.redirect(`/content/video/edit/${video._id}`);
});

router.get('/api/articles/:user/:page', ensureContentCreator, async (req, res) => {
  const numResults = await Article.countDocuments({ owner: req.user.id });
  const articles = await Article.find({ owner: req.user.id })
    .sort({ date: -1 })
    .skip(req.params.page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  res.status(200).send({
    success: 'true',
    numResults,
    articles,
  });
});

router.get('/api/videos/:user/:page', ensureContentCreator, async (req, res) => {
  const numResults = await Video.countDocuments({ owner: req.user.id });
  const videos = await Video.find({ owner: req.user.id })
    .sort({ date: -1 })
    .skip(req.params.page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  res.status(200).send({
    success: 'true',
    numResults,
    videos,
  });
});

module.exports = router;
