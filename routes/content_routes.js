// Load Environment Variables
require('dotenv').config();

const express = require('express');
const { ensureAuth, ensureRole, csrfProtection } = require('./middleware');
const { render } = require('../serverjs/render');
const { getFeedData, getFeedEpisodes } = require('../serverjs/rss');
const Application = require('../models/application');
const Article = require('../models/article');
const Podcast = require('../models/podcast');
const PodcastEpisode = require('../models/podcastEpisode');
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

router.get('/browse', async (req, res) => {
  const results = 36;

  const articlesq = Article.find({ status: 'published' }).sort({ date: -1 }).limit(results);
  const episodesq = PodcastEpisode.find().sort({ date: -1 }).limit(results);
  const videosq = Video.find({ status: 'published' }).sort({ date: -1 }).limit(results);

  // We can do these queries in parallel
  const [articles, videos, episodes] = await Promise.all([articlesq, videosq, episodesq]);

  const content = [];

  for (const article of articles) {
    content.push({
      type: 'article',
      date: article.date,
      content: article,
    });
  }
  for (const video of videos) {
    content.push({
      type: 'video',
      date: video.date,
      content: video,
    });
  }
  for (const episode of episodes) {
    content.push({
      type: 'episode',
      date: episode.date,
      content: episode,
    });
  }

  content.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });

  content.splice(results);

  return render(req, res, 'BrowseContentPage', {
    content,
  });
});

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

router.get('/podcasts', async (req, res) => {
  return res.redirect('/content/podcasts/0');
});

router.get('/podcasts/:page', async (req, res) => {
  const count = await PodcastEpisode.countDocuments();
  const episodes = await PodcastEpisode.find()
    .sort({ date: -1 })
    .skip(req.params.page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  const podcasts = await Podcast.find({ status: 'published' }).sort({ date: -1 }).lean();

  return render(req, res, 'PodcastsPage', { podcasts, count, episodes, page: req.params.page });
});

router.get('/videos', async (req, res) => {
  return res.redirect('/content/videos/0');
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
    return res.redirect('/content/browse');
  }

  return render(req, res, 'ArticlePage', { article });
});

router.get('/podcast/:id', async (req, res) => {
  const podcast = await Podcast.findById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return res.redirect('/content/browse');
  }
  const episodes = await PodcastEpisode.find({ podcast: podcast._id }).sort({ date: -1 });

  return render(req, res, 'PodcastPage', { podcast, episodes });
});

router.get('/episode/:id', async (req, res) => {
  const episode = await PodcastEpisode.findById(req.params.id);

  if (!episode) {
    req.flash('danger', 'Podcast episode not found');
    return res.redirect('/content/browse');
  }

  return render(req, res, 'PodcastEpisodePage', { episode });
});

router.get('/video/:id', async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    req.flash('danger', 'Video not found');
    return res.redirect('/content/browse');
  }

  return render(req, res, 'VideoPage', { video });
});

router.get('/article/edit/:id', ensureContentCreator, async (req, res) => {
  const article = await Article.findById(req.params.id);

  if (!article) {
    req.flash('danger', 'Article not found');
    return res.redirect('/404');
  }

  if (article.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    return res.redirect(`/content/article/${article._id}`);
  }

  if (article.status === 'published') {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    return res.redirect(`/content/article/${article._id}`);
  }

  return render(req, res, 'EditArticlePage', { article });
});

router.get('/podcast/edit/:id', ensureContentCreator, async (req, res) => {
  const podcast = await Podcast.findById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return res.redirect('/404');
  }

  if (podcast.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only podcast owners can edit podcasts.');
    return res.redirect(`/content/podcast/${podcast._id}`);
  }

  if (podcast.status === 'published') {
    req.flash('danger', 'Unauthorized: Podcasts cannot be editted after being published.');
    return res.redirect(`/content/podcast/${podcast._id}`);
  }

  return render(req, res, 'EditPodcastPage', { podcast });
});

router.get('/podcast/update/:id', ensureContentCreator, async (req, res) => {
  const podcast = await Podcast.findById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return res.redirect('/404');
  }

  if (podcast.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only podcast owners can fetch podcast episodes.');
    return res.redirect(`/content/podcast/${podcast._id}`);
  }

  if (podcast.status !== 'published') {
    req.flash('danger', 'Unauthorized: Only podcasts that have been published can have episodes fetched.');
    return res.redirect(`/content/podcast/${podcast._id}`);
  }

  const episodes = await getFeedEpisodes(podcast.rss);

  const liveEpisodes = await PodcastEpisode.find({ guid: { $in: episodes.map((episode) => episode.guid) } });

  const guids = liveEpisodes.map((episode) => episode.guid);

  const filtered = episodes.filter((episode) => !guids.includes(episode.guid));

  await Promise.all(
    filtered.map((episode) => {
      const podcastEpisode = new PodcastEpisode();

      podcastEpisode.title = episode.title;
      podcastEpisode.description = episode.description;
      podcastEpisode.source = episode.source;
      podcastEpisode.guid = episode.guid;
      podcastEpisode.link = episode.link;
      podcastEpisode.date = new Date(episode.date);

      podcastEpisode.podcast = podcast._id;
      podcastEpisode.owner = podcast.owner;
      podcastEpisode.image = podcast.image;
      podcastEpisode.username = podcast.username;
      podcastEpisode.podcastname = podcast.title;

      return podcastEpisode.save();
    }),
  );

  podcast.date = new Date();
  await podcast.save();

  req.flash('success', 'Podcast has been updated with all episodes.');

  return res.redirect(`/content/podcast/${podcast._id}`);
});

router.get('/video/edit/:id', ensureContentCreator, async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    req.flash('danger', 'Video not found');
    return res.redirect('/404');
  }

  if (video.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    return res.redirect(`/content/video/${video._id}`);
  }

  if (video.status === 'published') {
    req.flash('danger', 'Unauthorized: Videos cannot be editted after being published.');
    return res.redirect(`/content/video/${video._id}`);
  }

  return render(req, res, 'EditVideoPage', { video });
});

router.post('/editarticle', ensureContentCreator, async (req, res) => {
  const { articleid, title, image, imagename, artist, body, short } = req.body;

  const article = await Article.findById(articleid);

  if (article.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    return res.redirect(`/content/article/${article._id}`);
  }

  if (article.status === 'published') {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    return res.redirect(`/content/article/${article._id}`);
  }

  article.title = title.substring(0, 1000);
  article.short = short.substring(0, 1000);
  article.image = image.substring(0, 1000);
  article.imagename = imagename.substring(0, 1000);
  article.artist = artist.substring(0, 1000);
  article.body = body.substring(0, 1000000);

  await article.save();

  return res.redirect(`/content/article/edit/${article._id}`);
});

router.post('/editpodcast', ensureContentCreator, async (req, res) => {
  const { podcastid, rss } = req.body;

  const podcast = await Podcast.findById(podcastid);

  if (podcast.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only podcast owners can edit podcasts.');
    return res.redirect(`/content/podcast/${podcast._id}`);
  }

  if (podcast.status === 'published') {
    req.flash('danger', 'Unauthorized: podcasts cannot be editted after being published.');
    return res.redirect(`/content/podcast/${podcast._id}`);
  }

  podcast.rss = rss;
  const fields = await getFeedData(rss);
  podcast.title = fields.title;
  podcast.description = fields.description;
  podcast.url = fields.url;
  podcast.image = fields.image;

  await podcast.save();

  return res.redirect(`/content/podcast/edit/${podcast._id}`);
});

router.post('/editvideo', ensureContentCreator, async (req, res) => {
  const { videoid, title, image, imagename, artist, body, url, short } = req.body;

  const video = await Video.findById(videoid);

  if (video.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    return res.redirect(`/content/video/${video._id}`);
  }

  if (video.status === 'published') {
    req.flash('danger', 'Unauthorized: videos cannot be editted after being published.');
    return res.redirect(`/content/video/${video._id}`);
  }

  video.title = title.substring(0, 1000);
  video.short = short.substring(0, 1000);
  video.image = image.substring(0, 1000);
  video.imagename = imagename.substring(0, 1000);
  video.artist = artist.substring(0, 1000);
  video.url = url.substring(0, 1000);
  video.body = body.substring(0, 1000000);

  await video.save();

  return res.redirect(`/content/video/edit/${video._id}`);
});

router.post('/submitarticle', ensureContentCreator, async (req, res) => {
  const { articleid, title, image, imagename, artist, body, short } = req.body;

  const article = await Article.findById(articleid);

  if (article.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    return res.redirect(`/content/article/${article._id}`);
  }

  if (article.status === 'published') {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    return res.redirect(`/content/article/${article._id}`);
  }

  article.title = title.substring(0, 1000);
  article.short = short.substring(0, 1000);
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

  return res.redirect(`/content/article/edit/${article._id}`);
});

router.post('/submitpodcast', ensureContentCreator, async (req, res) => {
  const { podcastid, rss } = req.body;

  const podcast = await Podcast.findById(podcastid);

  if (podcast.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only podcast owners can edit podcasts.');
    return res.redirect(`/content/podcast/${podcast._id}`);
  }

  if (podcast.status === 'published') {
    req.flash('danger', 'Unauthorized: podcasts cannot be editted after being published.');
    return res.redirect(`/content/podcast/${podcast._id}`);
  }

  podcast.rss = rss;
  const fields = await getFeedData(rss);
  podcast.title = fields.title;
  podcast.description = fields.description;
  podcast.url = fields.url;
  podcast.image = fields.image;
  podcast.status = 'inReview';

  await podcast.save();
  req.flash(
    'success',
    'Your podcast has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  return res.redirect(`/content/podcast/edit/${podcast._id}`);
});

router.post('/submitvideo', ensureContentCreator, async (req, res) => {
  const { videoid, title, image, imagename, artist, body, url, short } = req.body;

  const video = await Video.findById(videoid);

  if (video.owner !== req.user.id) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    return res.redirect(`/content/video/${video._id}`);
  }

  if (video.status === 'published') {
    req.flash('danger', 'Unauthorized: videos cannot be editted after being published.');
    return res.redirect(`/content/video/${video._id}`);
  }

  video.title = title.substring(0, 1000);
  video.short = short.substring(0, 1000);
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

  return res.redirect(`/content/video/edit/${video._id}`);
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
  article.short = 'This is a brand new article!';
  article.imagename = 'emmessi tome [mb1-1579]';
  article.status = 'draft';
  article.username = req.user.username;

  await article.save();

  return res.redirect(`/content/article/edit/${article._id}`);
});

router.get('/newpodcast', ensureContentCreator, async (req, res) => {
  const podcast = new Podcast();

  podcast.title = 'New Podcast';
  podcast.description = '';
  podcast.url = '';
  podcast.rss = '';
  podcast.owner = req.user.id;
  podcast.image =
    'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/d/e/decb78dd-03d7-43a0-8ff5-1b97c6f515c9.jpg?1580015192';
  podcast.date = new Date();

  podcast.status = 'draft';
  podcast.username = req.user.username;

  await podcast.save();

  return res.redirect(`/content/podcast/edit/${podcast._id}`);
});

router.get('/newvideo', ensureContentCreator, async (req, res) => {
  const video = new Video();

  video.title = 'New Video';
  video.body = '';
  video.short = 'This is a brand new video!';
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

  return res.redirect(`/content/video/edit/${video._id}`);
});

router.get('/api/articles/:user/:page', ensureContentCreator, async (req, res) => {
  const numResults = await Article.countDocuments({ owner: req.user.id });
  const articles = await Article.find({ owner: req.user.id })
    .sort({ date: -1 })
    .skip(req.params.page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return res.status(200).send({
    success: 'true',
    numResults,
    articles,
  });
});

router.get('/api/podcasts/:user/:page', ensureContentCreator, async (req, res) => {
  const numResults = await Podcast.countDocuments({ owner: req.user.id });
  const podcasts = await Podcast.find({ owner: req.user.id })
    .sort({ date: -1 })
    .skip(req.params.page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return res.status(200).send({
    success: 'true',
    numResults,
    podcasts,
  });
});

router.get('/api/videos/:user/:page', ensureContentCreator, async (req, res) => {
  const numResults = await Video.countDocuments({ owner: req.user.id });
  const videos = await Video.find({ owner: req.user.id })
    .sort({ date: -1 })
    .skip(req.params.page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return res.status(200).send({
    success: 'true',
    numResults,
    videos,
  });
});

module.exports = router;
