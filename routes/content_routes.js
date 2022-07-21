// Load Environment Variables
require('dotenv').config();

const express = require('express');
const { ensureAuth, ensureRole, csrfProtection } = require('./middleware');
const { render } = require('../serverjs/render');
const { getFeedData } = require('../serverjs/rss');
const { updatePodcast } = require('../serverjs/podcast');
const generateMeta = require('../serverjs/meta');
const Notice = require('../dynamo/models/notice');
const Content = require('../dynamo/models/content');

const { getImageData } = require('../serverjs/util');

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
    const application = {
      User: req.user.Id,
      Body: req.body.info,
      Date: new Date().valueOf(),
      Type: Notice.TYPE.APPLICATION,
    };
    await Notice.put(application);

    req.flash('success', 'Your application has been submitted. We will reach out via email when a decision is made.');
    return render(req, res, 'ApplicationPage');
  } catch (err) {
    req.flash('danger', 'Please log in to apply to be a content creator partner.');
    return render(req, res, 'ApplicationPage');
  }
});

router.get('/creators', ensureContentCreator, async (req, res) => {
  const articles = await Content.getByTypeAndOwner(Content.TYPES.ARTICLE, req.user.Id);
  const videos = await Content.getByTypeAndOwner(Content.TYPES.VIDEO, req.user.Id);
  const podcasts = await Content.getByTypeAndOwner(Content.TYPES.PODCAST, req.user.Id);
  return render(req, res, 'CreatorsPage', { articles, videos, podcasts });
});

router.get('/browse', async (req, res) => {
  const content = await Content.getByStatus(Content.STATUS.PUBLISHED);

  return render(req, res, 'BrowseContentPage', {
    content: content.items,
    lastKey: content.lastKey,
  });
});

router.post('/getmore', async (req, res) => {
  const { lastKey } = req.body;
  const content = await Content.getByStatus(Content.STATUS.PUBLISHED, lastKey);

  return res.status(200).send({
    success: 'true',
    content: content.items,
    lastKey: content.lastKey,
  });
});

router.get('/articles', async (req, res) => {
  const content = await Content.getByTypeAndStatus(Content.TYPES.ARTICLE, Content.STATUS.PUBLISHED);

  return render(req, res, 'ArticlesPage', { articles: content.items, lastKey: content.lastKey });
});

router.post('/getmorearticles', async (req, res) => {
  const { lastKey } = req.body;
  const content = await Content.getByTypeAndStatus(Content.TYPES.ARTICLE, Content.STATUS.PUBLISHED, lastKey);

  return res.status(200).send({
    success: 'true',
    articles: content.items,
    lastKey: content.lastKey,
  });
});

router.get('/videos', async (req, res) => {
  const content = await Content.getByTypeAndStatus(Content.TYPES.VIDEO, Content.STATUS.PUBLISHED);

  return render(req, res, 'VideosPage', { videos: content.items, lastKey: content.lastKey });
});

router.post('/getmorevideos', async (req, res) => {
  const { lastKey } = req.body;
  const content = await Content.getByTypeAndStatus(Content.TYPES.VIDEO, Content.STATUS.PUBLISHED, lastKey);

  return res.status(200).send({
    success: 'true',
    episodes: content.items,
    lastKey: content.lastKey,
  });
});

router.get('/podcasts', async (req, res) => {
  const content = await Content.getByTypeAndStatus(Content.TYPES.EPISODE, Content.STATUS.PUBLISHED);
  const podcasts = await Content.getByTypeAndStatus(Content.TYPES.PODCAST, Content.STATUS.PUBLISHED);

  return render(req, res, 'PodcastsPage', {
    episodes: content.items,
    podcasts: podcasts.items,
    lastKey: content.lastKey,
  });
});

router.post('/getmorepodcasts', async (req, res) => {
  const { lastKey } = req.body;
  const content = await Content.getByTypeAndStatus(Content.TYPES.EPISODE, Content.STATUS.PUBLISHED, lastKey);

  return res.status(200).send({
    success: 'true',
    episodes: content.items,
    lastKey: content.lastKey,
  });
});

router.get('/a/:id', (req, res) => {
  res.redirect(`/content/article/${req.params.id}`);
});

router.get('/p/:id', (req, res) => {
  res.redirect(`/content/podcast/${req.params.id}`);
});

router.get('/v/:id', (req, res) => {
  res.redirect(`/content/video/${req.params.id}`);
});

router.get('/article/:id', async (req, res) => {
  const article = await Content.getById(req.params.id);

  if (!article) {
    req.flash('danger', 'Article not found');
    return res.redirect('/content/browse');
  }

  const imageDetails = getImageData(article.ImageName);

  return render(
    req,
    res,
    'ArticlePage',
    { article },
    {
      title: article.Title,
      metadata: generateMeta(
        article.Title,
        article.Short || 'An article posted to Cube Cobra',
        imageDetails.uri,
        `https://cubecobra.com/content/article/${req.params.id}`,
      ),
    },
  );
});

router.get('/podcast/:id', async (req, res) => {
  const podcast = await Content.getById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return res.redirect('/content/browse');
  }
  let result = await Content.getByTypeAndStatus(Content.TYPES.EPISODE, Content.STATUS.PUBLISHED);
  let episodes = result.items.filter((item) => item.PodcastId === podcast.Id);

  while (result.lastKey) {
    // eslint-disable-next-line no-await-in-loop
    result = await Content.getByTypeAndStatus(Content.TYPES.EPISODE, Content.STATUS.PUBLISHED, result.lastKey);
    episodes = [...episodes, ...result.items.filter((item) => item.PodcastId === podcast.Id)];
  }

  return render(
    req,
    res,
    'PodcastPage',
    { podcast, episodes },
    {
      title: podcast.Title,
      metadata: generateMeta(
        podcast.Title,
        `Listen to ${podcast.Title} on Cube Cobra!`,
        podcast.Image,
        `https://cubecobra.com/content/podcast/${req.params.id}`,
      ),
    },
  );
});

router.get('/episode/:id', async (req, res) => {
  const episode = await Content.getById(req.params.id);

  if (!episode) {
    req.flash('danger', 'Podcast episode not found');
    return res.redirect('/content/browse');
  }

  return render(
    req,
    res,
    'PodcastEpisodePage',
    { episode },
    {
      title: episode.Title,
      metadata: generateMeta(
        episode.Title,
        `Listen to ${episode.Title} on Cube Cobra!`,
        episode.Image,
        `https://cubecobra.com/content/episode/${req.params.id}`,
      ),
    },
  );
});

router.get('/video/:id', async (req, res) => {
  const video = await Content.getById(req.params.id);

  if (!video) {
    req.flash('danger', 'Video not found');
    return res.redirect('/content/browse');
  }

  const imageDetails = getImageData(video.ImageName);

  return render(
    req,
    res,
    'VideoPage',
    { video },
    {
      title: video.title,
      metadata: generateMeta(
        video.Title,
        video.Short || 'A video posted to Cube Cobra',
        imageDetails.uri,
        `https://cubecobra.com/content/video/${req.params.id}`,
      ),
    },
  );
});

router.get('/article/edit/:id', ensureContentCreator, async (req, res) => {
  const article = await Content.getById(req.params.id);
  if (!article) {
    req.flash('danger', 'Article not found');
    return res.redirect('/404');
  }

  if (!req.user.Id === article.Owner) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    return res.redirect(`/content/article/${article.Id}`);
  }

  if (article.Status === Content.STATUS.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    return res.redirect(`/content/article/${article.Id}`);
  }

  return render(req, res, 'EditArticlePage', { article });
});

router.get('/podcast/edit/:id', ensureContentCreator, async (req, res) => {
  const podcast = await Content.getById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return res.redirect('/404');
  }

  if (!req.user.Id === podcast.Owner) {
    req.flash('danger', 'Unauthorized: Only podcast owners can edit podcasts.');
    return res.redirect(`/content/podcast/${podcast.Id}`);
  }

  if (podcast.status === 'published') {
    req.flash('danger', 'Unauthorized: Podcasts cannot be editted after being published.');
    return res.redirect(`/content/podcast/${podcast.Id}`);
  }

  return render(req, res, 'EditPodcastPage', { podcast });
});

router.get('/podcast/update/:id', ensureContentCreator, async (req, res) => {
  const podcast = await Content.getById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return res.redirect('/404');
  }

  if (!req.user.Id === podcast.Owner) {
    req.flash('danger', 'Unauthorized: Only podcast owners can fetch podcast episodes.');
    return res.redirect(`/content/podcast/${podcast.Id}`);
  }

  if (podcast.status !== 'published') {
    req.flash('danger', 'Unauthorized: Only podcasts that have been published can have episodes fetched.');
    return res.redirect(`/content/podcast/${podcast.Id}`);
  }

  await updatePodcast(podcast);

  req.flash('success', 'Podcast has been updated with all episodes.');

  return res.redirect(`/content/podcast/${podcast.Id}`);
});

router.get('/video/edit/:id', ensureContentCreator, async (req, res) => {
  const video = await Content.getById(req.params.id);

  if (!video) {
    req.flash('danger', 'Video not found');
    return res.redirect('/404');
  }

  if (!req.user.Id === video.Owner) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    return res.redirect(`/content/video/${video.Id}`);
  }

  if (video.Status === Content.STATUS.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Videos cannot be editted after being published.');
    return res.redirect(`/content/video/${video.Id}`);
  }

  return render(req, res, 'EditVideoPage', { video });
});

router.post('/editarticle', ensureContentCreator, async (req, res) => {
  const { articleid, title, imagename, body, short } = req.body;

  const article = await Content.getById(articleid);

  if (!req.user.Id === article.Owner) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    return res.redirect(`/content/article/${article.Id}`);
  }

  if (article.Status === Content.STATUS.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    return res.redirect(`/content/article/${article.Id}`);
  }

  article.Title = title.substring(0, 1000);
  article.Short = short.substring(0, 1000);
  article.ImageName = imagename.substring(0, 1000);
  article.Body = body.substring(0, 1000000);

  await Content.update(article);

  return res.redirect(`/content/article/edit/${article.Id}`);
});

router.post('/editpodcast', ensureContentCreator, async (req, res) => {
  const { podcastid, rss } = req.body;

  const podcast = await Content.getById(podcastid);

  if (!req.user.Id === podcast.Owner) {
    req.flash('danger', 'Unauthorized: Only podcast owners can edit podcasts.');
    return res.redirect(`/content/podcast/${podcast.Id}`);
  }

  if (podcast.Status === 'published') {
    req.flash('danger', 'Unauthorized: podcasts cannot be editted after being published.');
    return res.redirect(`/content/podcast/${podcast.Id}`);
  }

  podcast.Url = rss;
  const fields = await getFeedData(rss);
  podcast.Title = fields.title;
  podcast.Description = fields.description;
  podcast.PodcastLink = fields.url;
  podcast.Image = fields.Image;

  await Content.update(podcast);

  return res.redirect(`/content/podcast/edit/${podcast.Id}`);
});

router.post('/editvideo', ensureContentCreator, async (req, res) => {
  const { videoid, title, imagename, body, url, short } = req.body;

  const video = await Content.getById(videoid);

  if (!req.user.Id === video.Owner) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    return res.redirect(`/content/video/${video.Id}`);
  }

  if (video.Status === Content.STATUS.PUBLISHED) {
    req.flash('danger', 'Unauthorized: videos cannot be editted after being published.');
    return res.redirect(`/content/video/${video.Id}`);
  }

  video.Title = title.substring(0, 1000);
  video.Short = short.substring(0, 1000);
  video.ImageName = imagename.substring(0, 1000);
  video.Url = url.substring(0, 1000);
  video.Body = body.substring(0, 1000000);

  await Content.update(video);

  return res.redirect(`/content/video/edit/${video.Id}`);
});

router.post('/submitarticle', ensureContentCreator, async (req, res) => {
  const { articleid, title, imagename, body, short } = req.body;

  const article = await Content.getById(articleid);

  if (!req.user.Id === article.Owner) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    return res.redirect(`/content/article/${article.Id}`);
  }

  if (article.Status === Content.STATUS.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    return res.redirect(`/content/article/${article.Id}`);
  }

  article.Title = title.substring(0, 1000);
  article.Short = short.substring(0, 1000);
  article.ImageName = imagename.substring(0, 1000);
  article.Body = body.substring(0, 1000000);
  article.Status = Content.STATUS.IN_REVIEW;

  await Content.update(article);
  req.flash(
    'success',
    'Your article has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  return res.redirect(`/content/article/edit/${article.Id}`);
});

router.post('/submitpodcast', ensureContentCreator, async (req, res) => {
  const { podcastid, rss } = req.body;

  const podcast = await Content.getById(podcastid);

  if (!req.user.Id === podcast.Owner) {
    req.flash('danger', 'Unauthorized: Only podcast owners can edit podcasts.');
    return res.redirect(`/content/podcast/${podcast.Id}`);
  }

  if (podcast.Status === Content.STATUS.PUBLISHED) {
    req.flash('danger', 'Unauthorized: podcasts cannot be editted after being published.');
    return res.redirect(`/content/podcast/${podcast._id}`);
  }

  podcast.Url = rss;
  const fields = await getFeedData(rss);
  podcast.Title = fields.title;
  podcast.Description = fields.description;
  podcast.PodcastLink = fields.url;
  podcast.Image = fields.Image;
  podcast.Status = 'inReview';

  await Content.update(podcast);
  req.flash(
    'success',
    'Your podcast has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  return res.redirect(`/content/podcast/edit/${podcast.Id}`);
});

router.post('/submitvideo', ensureContentCreator, async (req, res) => {
  const { videoid, title, imagename, body, url, short } = req.body;

  const video = await Content.getById(videoid);

  if (!req.user.Id === video.Owner) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    return res.redirect(`/content/video/${video.Id}`);
  }

  if (video.Status === Content.STATUS.PUBLISHED) {
    req.flash('danger', 'Unauthorized: videos cannot be editted after being published.');
    return res.redirect(`/content/video/${video.Id}`);
  }

  video.Title = title.substring(0, 1000);
  video.Short = short.substring(0, 1000);
  video.ImageName = imagename.substring(0, 1000);
  video.Url = url.substring(0, 1000);
  video.Body = body.substring(0, 1000000);
  video.Status = 'inReview';

  await Content.update(video);
  req.flash(
    'success',
    'Your video has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  return res.redirect(`/content/video/edit/${video.Id}`);
});

router.get('/newarticle', ensureContentCreator, async (req, res) => {
  const article = {
    Title: 'New Article',
    Owner: `${req.user.Id}`,
    Date: new Date().valueOf(),
    Image:
      'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/d/e/decb78dd-03d7-43a0-8ff5-1b97c6f515c9.jpg?1580015192',
    Artist: 'Craig J Spearing',
    Short: 'This is a brand new article!',
    ImageName: 'emmessi tome [mb1-1579]',
    Status: Content.STATUS.DRAFT,
    Username: req.user.Username,
  };

  const id = await Content.put(article, Content.TYPES.ARTICLE);

  return res.redirect(`/content/article/edit/${id}`);
});

router.get('/newpodcast', ensureContentCreator, async (req, res) => {
  const podcast = {
    tTtle: 'New Podcast',
    Owner: `${req.user.Id}`,
    Image:
      'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/d/e/decb78dd-03d7-43a0-8ff5-1b97c6f515c9.jpg?1580015192',
    Date: new Date().valueOf(),
    Status: Content.STATUS.DRAFT,
    Username: req.user.Username,
  };

  const id = await Content.put(podcast, Content.TYPES.PODCAST);

  return res.redirect(`/content/podcast/edit/${id}`);
});

router.get('/newvideo', ensureContentCreator, async (req, res) => {
  const video = {
    Title: 'New Video',
    Short: 'This is a brand new video!',
    Owner: `${req.user.Id}`,
    Date: new Date().valueOf(),
    Image:
      'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/d/e/decb78dd-03d7-43a0-8ff5-1b97c6f515c9.jpg?1580015192',
    Artist: 'Craig J Spearing',
    ImageName: 'emmessi tome [mb1-1579]',
    Status: Content.STATUS.DRAFT,
    Username: req.user.Username,
  };

  const id = await Content.put(video, Content.TYPES.VIDEO);

  return res.redirect(`/content/video/edit/${id}`);
});

router.post('/getcreatorcontent', ensureContentCreator, async (req, res) => {
  const { lastKey, type } = req.body;
  const content = await Content.getByTypeAndOwner(type, req.user.Id, lastKey);

  return res.status(200).send({
    success: 'true',
    content: content.items,
    lastKey: content.lastKey,
  });
});

module.exports = router;
