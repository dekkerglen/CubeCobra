// Load Environment Variables
require('dotenv').config();

const express = require('express');
const { ensureAuth, ensureRole, csrfProtection } = require('./middleware');
const { render, redirect } = require('../util/render');
const { getFeedData } = require('../util/rss');
const { updatePodcast } = require('../util/podcast');
const util = require('../util/util');
const generateMeta = require('../util/meta');
const Notice = require('../dynamo/models/notice');
const Content = require('../dynamo/models/content');

const ensureContentCreator = ensureRole('ContentCreator');

import { ContentStatus, ContentType } from '../datatypes/Content';
import { NoticeType } from '../datatypes/Notice';

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
      user: req.user.id,
      body: req.body.info,
      date: new Date().valueOf(),
      type: NoticeType.APPLICATION,
    };
    await Notice.put(application);

    req.flash('success', 'Your application has been submitted. We will reach out via email when a decision is made.');
    return render(req, res, 'ApplicationPage');
  } catch {
    req.flash('danger', 'Please log in to apply to be a content creator partner.');
    return render(req, res, 'ApplicationPage');
  }
});

router.get('/creators', ensureContentCreator, async (req, res) => {
  const articles = await Content.getByTypeAndOwner(ContentType.ARTICLE, req.user.id);
  const videos = await Content.getByTypeAndOwner(ContentType.VIDEO, req.user.id);
  const podcasts = await Content.getByTypeAndOwner(ContentType.PODCAST, req.user.id);
  return render(req, res, 'CreatorsPage', { articles, videos, podcasts });
});

router.get('/browse', async (req, res) => {
  const content = await Content.getByStatus(ContentStatus.PUBLISHED);

  return render(req, res, 'BrowseContentPage', {
    content: content.items.filter((item) =>
      [ContentType.ARTICLE, ContentType.VIDEO, ContentType.EPISODE].includes(item.type),
    ),
    lastKey: content.lastKey,
  });
});

router.post('/getmore', async (req, res) => {
  const { lastKey } = req.body;
  const content = await Content.getByStatus(ContentStatus.PUBLISHED, lastKey);

  return res.status(200).send({
    success: 'true',
    items: content.items.filter((item) =>
      [ContentType.ARTICLE, ContentType.VIDEO, ContentType.EPISODE].includes(item.type),
    ),
    lastKey: content.lastKey,
  });
});

router.get('/articles', async (req, res) => {
  const content = await Content.getByTypeAndStatus(ContentType.ARTICLE, ContentStatus.PUBLISHED);

  return render(req, res, 'ArticlesPage', { articles: content.items, lastKey: content.lastKey });
});

router.post('/getmorearticles', async (req, res) => {
  const { lastKey } = req.body;
  const content = await Content.getByTypeAndStatus(ContentType.ARTICLE, ContentStatus.PUBLISHED, lastKey);

  return res.status(200).send({
    success: 'true',
    items: content.items,
    lastKey: content.lastKey,
  });
});

router.get('/videos', async (req, res) => {
  const content = await Content.getByTypeAndStatus(ContentType.VIDEO, ContentStatus.PUBLISHED);

  return render(req, res, 'VideosPage', { videos: content.items, lastKey: content.lastKey });
});

router.post('/getmorevideos', async (req, res) => {
  const { lastKey } = req.body;
  const content = await Content.getByTypeAndStatus(ContentType.VIDEO, ContentStatus.PUBLISHED, lastKey);

  return res.status(200).send({
    success: 'true',
    items: content.items,
    lastKey: content.lastKey,
  });
});

router.get('/podcasts', async (req, res) => {
  const content = await Content.getByTypeAndStatus(ContentType.EPISODE, ContentStatus.PUBLISHED);
  const podcasts = await Content.getByTypeAndStatus(ContentType.PODCAST, ContentStatus.PUBLISHED);

  return render(req, res, 'PodcastsPage', {
    episodes: content.items,
    podcasts: podcasts.items,
    lastKey: content.lastKey,
  });
});

router.post('/getmorepodcasts', async (req, res) => {
  const { lastKey } = req.body;
  const content = await Content.getByTypeAndStatus(ContentType.EPISODE, ContentStatus.PUBLISHED, lastKey);

  return res.status(200).send({
    success: 'true',
    episodes: content.items,
    lastKey: content.lastKey,
  });
});

router.get('/a/:id', (req, res) => {
  redirect(req, res, `/content/article/${req.params.id}`);
});

router.get('/p/:id', (req, res) => {
  redirect(req, res, `/content/podcast/${req.params.id}`);
});

router.get('/v/:id', (req, res) => {
  redirect(req, res, `/content/video/${req.params.id}`);
});

router.get('/article/:id', async (req, res) => {
  const article = await Content.getById(req.params.id);

  if (!article) {
    req.flash('danger', 'Article not found');
    return redirect(req, res, '/content/browse');
  }

  if (article.status !== ContentStatus.PUBLISHED) {
    if (!req.user || req.user.id !== article.owner.id) {
      req.flash('danger', 'Article not found');
      return redirect(req, res, '/content/browse');
    }

    if (req.user.id === article.owner.id) {
      return redirect(req, res, `/content/article/edit/${article.id}`);
    }
  }

  const baseUrl = util.getBaseUrl();
  return render(
    req,
    res,
    'ArticlePage',
    { article },
    {
      title: article.title,
      metadata: generateMeta(
        article.title,
        article.short || 'An article posted to Cube Cobra',
        article.image.uri,
        `${baseUrl}/content/article/${req.params.id}`,
      ),
    },
  );
});

router.get('/podcast/:id', async (req, res) => {
  const podcast = await Content.getById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return redirect(req, res, '/content/browse');
  }
  let result = await Content.getByTypeAndStatus(ContentType.EPISODE, ContentStatus.PUBLISHED);
  let episodes = result.items.filter((item) => item.podcast === podcast.id);

  while (result.lastKey) {
    result = await Content.getByTypeAndStatus(ContentType.EPISODE, ContentStatus.PUBLISHED, result.lastKey);
    episodes = [...episodes, ...result.items.filter((item) => item.podcast === podcast.id)];
  }

  const baseUrl = util.getBaseUrl();
  return render(
    req,
    res,
    'PodcastPage',
    { podcast, episodes },
    {
      title: podcast.title,
      metadata: generateMeta(
        podcast.title,
        `Listen to ${podcast.title} on Cube Cobra!`,
        podcast.image,
        `${baseUrl}/content/podcast/${req.params.id}`,
      ),
    },
  );
});

router.get('/episode/:id', async (req, res) => {
  const episode = await Content.getById(req.params.id);

  if (!episode) {
    req.flash('danger', 'Podcast episode not found');
    return redirect(req, res, '/content/browse');
  }

  const baseUrl = util.getBaseUrl();
  return render(
    req,
    res,
    'PodcastEpisodePage',
    { episode },
    {
      title: episode.title,
      metadata: generateMeta(
        episode.title,
        `Listen to ${episode.title} on Cube Cobra!`,
        episode.image,
        `${baseUrl}/content/episode/${req.params.id}`,
      ),
    },
  );
});

router.get('/video/:id', async (req, res) => {
  const video = await Content.getById(req.params.id);

  if (!video) {
    req.flash('danger', 'Video not found');
    return redirect(req, res, '/content/browse');
  }

  const baseUrl = util.getBaseUrl();
  return render(
    req,
    res,
    'VideoPage',
    { video },
    {
      title: video.title,
      metadata: generateMeta(
        video.title,
        video.short || 'A video posted to Cube Cobra',
        video.image.uri,
        `${baseUrl}/content/video/${req.params.id}`,
      ),
    },
  );
});

router.get('/article/edit/:id', ensureContentCreator, async (req, res) => {
  const article = await Content.getById(req.params.id);

  if (!article) {
    req.flash('danger', 'Article not found');
    return redirect(req, res, '/404');
  }

  if (!req.user.id === article.owner.id) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    return redirect(req, res, `/content/article/${article.id}`);
  }

  if (article.status === ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    return redirect(req, res, `/content/article/${article.id}`);
  }

  return render(req, res, 'EditArticlePage', { article });
});

router.get('/podcast/edit/:id', ensureContentCreator, async (req, res) => {
  const podcast = await Content.getById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return redirect(req, res, '/404');
  }

  if (!req.user.id === podcast.owner.id) {
    req.flash('danger', 'Unauthorized: Only podcast owners can edit podcasts.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  if (podcast.status === 'published') {
    req.flash('danger', 'Unauthorized: Podcasts cannot be editted after being published.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  return render(req, res, 'EditPodcastPage', { podcast });
});

router.get('/podcast/update/:id', ensureContentCreator, async (req, res) => {
  const podcast = await Content.getById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== podcast.owner.id) {
    req.flash('danger', 'Unauthorized: Only podcast owners can fetch podcast episodes.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  if (podcast.status !== 'published') {
    req.flash('danger', 'Unauthorized: Only podcasts that have been published can have episodes fetched.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  await updatePodcast(podcast);

  req.flash('success', 'Podcast has been updated with all episodes.');

  return redirect(req, res, `/content/podcast/${podcast.id}`);
});

router.get('/video/edit/:id', ensureContentCreator, async (req, res) => {
  const video = await Content.getById(req.params.id);

  if (!video) {
    req.flash('danger', 'Video not found');
    return redirect(req, res, '/404');
  }

  if (!req.user.id === video.owner.id) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    return redirect(req, res, `/content/video/${video.id}`);
  }

  if (video.status === ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Videos cannot be editted after being published.');
    return redirect(req, res, `/content/video/${video.id}`);
  }

  return render(req, res, 'EditVideoPage', { video });
});

router.post('/editarticle', ensureContentCreator, async (req, res) => {
  const { articleid, title, imagename, body, short } = req.body;

  const article = await Content.getById(articleid);

  if (!req.user.id === article.owner.id) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    return redirect(req, res, `/content/article/${article.id}`);
  }

  if (article.status === ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    return redirect(req, res, `/content/article/${article.id}`);
  }

  article.title = title.substring(0, 1000);
  article.short = short.substring(0, 1000);
  article.imageName = imagename.substring(0, 1000);
  article.body = body.substring(0, 1000000);

  await Content.update(article);

  return redirect(req, res, `/content/article/edit/${article.id}`);
});

router.post('/editpodcast', ensureContentCreator, async (req, res) => {
  const { podcastid, rss } = req.body;

  const podcast = await Content.getById(podcastid);

  if (!req.user.id === podcast.owner.id) {
    req.flash('danger', 'Unauthorized: Only podcast owners can edit podcasts.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  if (podcast.status === 'published') {
    req.flash('danger', 'Unauthorized: podcasts cannot be editted after being published.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  podcast.url = rss;
  const fields = await getFeedData(rss);
  podcast.title = fields.title;
  podcast.description = fields.description;
  podcast.podcastLink = fields.url;
  podcast.image = fields.image;

  await Content.update(podcast);

  return redirect(req, res, `/content/podcast/edit/${podcast.id}`);
});

router.post('/editvideo', ensureContentCreator, async (req, res) => {
  const { videoid, title, imagename, body, url, short } = req.body;

  const video = await Content.getById(videoid);

  if (!req.user.id === video.owner.id) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    return redirect(req, res, `/content/video/${video.id}`);
  }

  if (video.status === ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: videos cannot be editted after being published.');
    return redirect(req, res, `/content/video/${video.id}`);
  }

  video.title = title.substring(0, 1000);
  video.short = short.substring(0, 1000);
  video.imageName = imagename.substring(0, 1000);
  video.url = url.substring(0, 1000);
  video.body = body.substring(0, 1000000);

  await Content.update(video);

  return redirect(req, res, `/content/video/edit/${video.id}`);
});

router.post('/submitarticle', ensureContentCreator, async (req, res) => {
  const { articleid, title, imagename, body, short } = req.body;

  const article = await Content.getById(articleid);

  if (!req.user.id === article.owner.id) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    return redirect(req, res, `/content/article/${article.id}`);
  }

  if (article.status === ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    return redirect(req, res, `/content/article/${article.id}`);
  }

  article.title = title.substring(0, 1000);
  article.short = short.substring(0, 1000);
  article.imageName = imagename.substring(0, 1000);
  article.body = body.substring(0, 1000000);
  article.status = ContentStatus.IN_REVIEW;

  await Content.update(article);
  req.flash(
    'success',
    'Your article has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  return redirect(req, res, `/content/article/edit/${article.id}`);
});

router.post('/submitpodcast', ensureContentCreator, async (req, res) => {
  const { podcastid, rss } = req.body;

  const podcast = await Content.getById(podcastid);

  if (!req.user.id === podcast.owner.id) {
    req.flash('danger', 'Unauthorized: Only podcast owners can edit podcasts.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  if (podcast.status === ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: podcasts cannot be editted after being published.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  podcast.url = rss;
  const fields = await getFeedData(rss);
  podcast.title = fields.title;
  podcast.description = fields.description;
  podcast.podcastLink = fields.url;
  podcast.image = fields.image;
  podcast.status = ContentStatus.IN_REVIEW;

  await Content.update(podcast);
  req.flash(
    'success',
    'Your podcast has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  return redirect(req, res, `/content/podcast/edit/${podcast.id}`);
});

router.post('/submitvideo', ensureContentCreator, async (req, res) => {
  const { videoid, title, imagename, body, url, short } = req.body;

  const video = await Content.getById(videoid);

  if (!req.user.id === video.owner.id) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    return redirect(req, res, `/content/video/${video.id}`);
  }

  if (video.status === ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: videos cannot be editted after being published.');
    return redirect(req, res, `/content/video/${video.id}`);
  }

  video.title = title.substring(0, 1000);
  video.short = short.substring(0, 1000);
  video.imageName = imagename.substring(0, 1000);
  video.url = url.substring(0, 1000);
  video.body = body.substring(0, 1000000);
  video.status = ContentStatus.IN_REVIEW;

  await Content.update(video);
  req.flash(
    'success',
    'Your video has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  return redirect(req, res, `/content/video/edit/${video.id}`);
});

router.get('/newarticle', ensureContentCreator, async (req, res) => {
  const article = {
    title: 'New Article',
    owner: req.user.id,
    date: new Date().valueOf(),
    image:
      'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/d/e/decb78dd-03d7-43a0-8ff5-1b97c6f515c9.jpg?1580015192',
    short: 'This is a brand new article!',
    imageName: 'emmessi tome [mb1-1579]',
    status: ContentStatus.DRAFT,
    username: req.user.username,
  };

  const id = await Content.put(article, ContentType.ARTICLE);

  return redirect(req, res, `/content/article/edit/${id}`);
});

router.get('/newpodcast', ensureContentCreator, async (req, res) => {
  const podcast = {
    title: 'New Podcast',
    owner: req.user.id,
    image:
      'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/d/e/decb78dd-03d7-43a0-8ff5-1b97c6f515c9.jpg?1580015192',
    date: new Date().valueOf(),
    status: ContentStatus.DRAFT,
    username: req.user.username,
  };

  const id = await Content.put(podcast, ContentType.PODCAST);

  return redirect(req, res, `/content/podcast/edit/${id}`);
});

router.get('/newvideo', ensureContentCreator, async (req, res) => {
  const video = {
    title: 'New Video',
    short: 'This is a brand new video!',
    owner: req.user.id,
    date: new Date().valueOf(),
    image:
      'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/d/e/decb78dd-03d7-43a0-8ff5-1b97c6f515c9.jpg?1580015192',
    imageName: 'emmessi tome [mb1-1579]',
    status: ContentStatus.DRAFT,
    username: req.user.username,
  };

  const id = await Content.put(video, ContentType.VIDEO);

  return redirect(req, res, `/content/video/edit/${id}`);
});

router.post('/getcreatorcontent', ensureContentCreator, async (req, res) => {
  const { lastKey, type } = req.body;
  const content = await Content.getByTypeAndOwner(type, req.user.id, lastKey);

  return res.status(200).send({
    success: 'true',
    content: content.items,
    lastKey: content.lastKey,
  });
});

module.exports = router;
