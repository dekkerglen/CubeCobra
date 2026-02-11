import { ContentStatus } from '@utils/datatypes/Content';
import { NoticeType } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { articleDao, episodeDao, noticeDao, podcastDao, videoDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth, ensureRole } from 'router/middleware';
import generateMeta from 'serverutils/meta';
import { updatePodcast } from 'serverutils/podcast';
import { redirect, render } from 'serverutils/render';
import { getFeedData } from 'serverutils/rss';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../types/express';

const ensureContentCreator = ensureRole(UserRoles.CONTENT_CREATOR);

// GET /content/application
export const applicationHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to apply to be a content creator partner.');
    return render(req, res, 'ContactPage');
  }
  return render(req, res, 'ApplicationPage');
};

// POST /content/submitapplication
export const submitApplicationHandler = async (req: Request, res: Response) => {
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
    await noticeDao.put(application);

    req.flash('success', 'Your application has been submitted. We will reach out via email when a decision is made.');
    return render(req, res, 'ApplicationPage');
  } catch {
    req.flash('danger', 'Please log in to apply to be a content creator partner.');
    return render(req, res, 'ApplicationPage');
  }
};

// GET /content/creators
export const creatorsHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to view this page.');
    return redirect(req, res, '/');
  }
  const articles = await articleDao.queryByOwner(req.user.id);
  const videos = await videoDao.queryByOwner(req.user.id);
  const podcasts = await podcastDao.queryByOwner(req.user.id);
  return render(req, res, 'CreatorsPage', { articles, videos, podcasts });
};

// GET /content/browse
export const browseHandler = async (req: Request, res: Response) => {
  // Query all three content types in parallel with page size of 20
  const [articlesResult, videosResult, episodesResult] = await Promise.all([
    articleDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 20),
    videoDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 20),
    episodeDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 20),
  ]);

  // Merge and sort by date descending
  const allContent = [
    ...(articlesResult.items || []),
    ...(videosResult.items || []),
    ...(episodesResult.items || []),
  ].sort((a, b) => b.date - a.date);

  // Create a dictionary of last keys for each content type
  const lastKey = {
    article: articlesResult.lastKey,
    video: videosResult.lastKey,
    episode: episodesResult.lastKey,
  };

  return render(req, res, 'BrowseContentPage', {
    content: allContent,
    lastKey,
  });
};

// POST /content/getmore
export const getMoreHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;

  // lastKey is now a dict with keys for each content type
  const articleLastKey = lastKey?.article;
  const videoLastKey = lastKey?.video;
  const episodeLastKey = lastKey?.episode;

  // Query all three content types in parallel with page size of 20
  const [articlesResult, videosResult, episodesResult] = await Promise.all([
    articleDao.queryByStatus(ContentStatus.PUBLISHED, articleLastKey, 20),
    videoDao.queryByStatus(ContentStatus.PUBLISHED, videoLastKey, 20),
    episodeDao.queryByStatus(ContentStatus.PUBLISHED, episodeLastKey, 20),
  ]);

  // Merge and sort by date descending
  const allContent = [
    ...(articlesResult.items || []),
    ...(videosResult.items || []),
    ...(episodesResult.items || []),
  ].sort((a, b) => b.date - a.date);

  // Create a dictionary of last keys for each content type
  const newLastKey = {
    article: articlesResult.lastKey,
    video: videosResult.lastKey,
    episode: episodesResult.lastKey,
  };

  return res.status(200).send({
    success: 'true',
    items: allContent,
    lastKey: newLastKey,
  });
};

// GET /content/articles
export const articlesHandler = async (req: Request, res: Response) => {
  const content = await articleDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 24);

  return render(req, res, 'ArticlesPage', { articles: content.items, lastKey: content.lastKey });
};

// POST /content/getmorearticles
export const getMoreArticlesHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;
  const content = await articleDao.queryByStatus(ContentStatus.PUBLISHED, lastKey, 24);

  return res.status(200).send({
    success: 'true',
    items: content.items,
    lastKey: content.lastKey,
  });
};

// GET /content/videos
export const videosHandler = async (req: Request, res: Response) => {
  const content = await videoDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 24);

  return render(req, res, 'VideosPage', { videos: content.items, lastKey: content.lastKey });
};

// POST /content/getmorevideos
export const getMoreVideosHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;
  const content = await videoDao.queryByStatus(ContentStatus.PUBLISHED, lastKey, 24);

  return res.status(200).send({
    success: 'true',
    items: content.items,
    lastKey: content.lastKey,
  });
};

// GET /content/podcasts
export const podcastsHandler = async (req: Request, res: Response) => {
  // Get episodes across all podcasts
  const content = await episodeDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 24);
  const podcasts = await podcastDao.queryByStatus(ContentStatus.PUBLISHED);

  return render(req, res, 'PodcastsPage', {
    episodes: content.items,
    podcasts: podcasts.items,
    lastKey: content.lastKey,
  });
};

// POST /content/getmorepodcasts
export const getMorePodcastsHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;
  // Get episodes across all podcasts
  const content = await episodeDao.queryByStatus(ContentStatus.PUBLISHED, lastKey, 24);

  return res.status(200).send({
    success: 'true',
    episodes: content.items,
    lastKey: content.lastKey,
  });
};

// GET /content/a/:id - redirect to article
export const aRedirectHandler = (req: Request, res: Response) => {
  redirect(req, res, `/content/article/${req.params.id}`);
};

// GET /content/p/:id - redirect to podcast
export const pRedirectHandler = (req: Request, res: Response) => {
  redirect(req, res, `/content/podcast/${req.params.id}`);
};

// GET /content/v/:id - redirect to video
export const vRedirectHandler = (req: Request, res: Response) => {
  redirect(req, res, `/content/video/${req.params.id}`);
};

// GET /content/article/:id
export const articleHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid article ID');
    return redirect(req, res, '/content/browse');
  }

  const article = await articleDao.getById(req.params.id);

  if (!article) {
    req.flash('danger', 'Article not found');
    return redirect(req, res, '/content/browse');
  }

  if (article.status !== ContentStatus.PUBLISHED && !req.user?.roles?.includes(UserRoles.ADMIN)) {
    if (!req.user || req.user.id !== article.owner.id) {
      req.flash('danger', 'Article not found');
      return redirect(req, res, '/content/browse');
    }

    if (req.user.id === article.owner.id) {
      return redirect(req, res, `/content/article/edit/${article.id}`);
    }
  }

  const baseUrl = getBaseUrl();
  return render(
    req,
    res,
    'ArticlePage',
    { article },
    {
      title: article.title || 'Article',
      metadata: generateMeta(
        article.title || 'Article',
        article.short || 'An article posted to Cube Cobra',
        article.imageName || '',
        `${baseUrl}/content/article/${req.params.id}`,
      ),
    },
  );
};

// GET /content/podcast/:id
export const podcastHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid podcast ID');
    return redirect(req, res, '/content/browse');
  }

  const podcast = await podcastDao.getById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return redirect(req, res, '/content/browse');
  }

  const episodesResult = await episodeDao.queryByPodcast(podcast.id, undefined, ContentStatus.PUBLISHED);

  console.log(episodesResult);

  const baseUrl = getBaseUrl();
  return render(
    req,
    res,
    'PodcastPage',
    { podcast, episodes: episodesResult.items },
    {
      title: podcast.title || 'Podcast',
      metadata: generateMeta(
        podcast.title || 'Podcast',
        `Listen to ${podcast.title || 'this podcast'} on Cube Cobra!`,
        podcast.imageName || '',
        `${baseUrl}/content/podcast/${req.params.id}`,
      ),
    },
  );
};

// GET /content/episode/:id
export const episodeHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid episode ID');
    return redirect(req, res, '/content/browse');
  }

  const episode = await episodeDao.getById(req.params.id);

  if (!episode) {
    req.flash('danger', 'Podcast episode not found');
    return redirect(req, res, '/content/browse');
  }

  const baseUrl = getBaseUrl();
  return render(
    req,
    res,
    'PodcastEpisodePage',
    { episode },
    {
      title: episode.title || 'Episode',
      metadata: generateMeta(
        episode.title || 'Episode',
        `Listen to ${episode.title || 'this episode'} on Cube Cobra!`,
        episode.imageName || '',
        `${baseUrl}/content/episode/${req.params.id}`,
      ),
    },
  );
};

// GET /content/video/:id
export const videoHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid video ID');
    return redirect(req, res, '/content/browse');
  }

  const video = await videoDao.getById(req.params.id);

  if (!video) {
    req.flash('danger', 'Video not found');
    return redirect(req, res, '/content/browse');
  }

  const baseUrl = getBaseUrl();
  return render(
    req,
    res,
    'VideoPage',
    { video },
    {
      title: video.title || 'Video',
      metadata: generateMeta(
        video.title || 'Video',
        video.short || 'A video posted to Cube Cobra',
        video.imageName || '',
        `${baseUrl}/content/video/${req.params.id}`,
      ),
    },
  );
};

// GET /content/article/edit/:id
export const articleEditHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid article ID');
    return redirect(req, res, '/404');
  }

  if (!req.user) {
    req.flash('danger', 'Please log in to edit articles.');
    return redirect(req, res, '/');
  }

  const article = await articleDao.getById(req.params.id);

  if (!article) {
    req.flash('danger', 'Article not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== article.owner.id) {
    req.flash('danger', 'Unauthorized: Only article owners can edit articles.');
    return redirect(req, res, `/content/article/${article.id}`);
  }

  if (article.status === ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Articles cannot be editted after being published.');
    return redirect(req, res, `/content/article/${article.id}`);
  }

  return render(req, res, 'EditArticlePage', { article });
};

// GET /content/podcast/edit/:id
export const podcastEditHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid podcast ID');
    return redirect(req, res, '/404');
  }

  if (!req.user) {
    req.flash('danger', 'Please log in to edit podcasts.');
    return redirect(req, res, '/');
  }

  const podcast = await podcastDao.getById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== podcast.owner.id) {
    req.flash('danger', 'Unauthorized: Only podcast owners can edit podcasts.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  if (podcast.status === ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Podcasts cannot be editted after being published.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  return render(req, res, 'EditPodcastPage', { podcast });
};

// GET /content/podcast/update/:id
export const podcastUpdateHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid podcast ID');
    return redirect(req, res, '/404');
  }

  if (!req.user) {
    req.flash('danger', 'Please log in to update podcasts.');
    return redirect(req, res, '/');
  }

  const podcast = await podcastDao.getById(req.params.id);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== podcast.owner.id) {
    req.flash('danger', 'Unauthorized: Only podcast owners can fetch podcast episodes.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  if (podcast.status !== ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Only podcasts that have been published can have episodes fetched.');
    return redirect(req, res, `/content/podcast/${podcast.id}`);
  }

  await updatePodcast(podcast);

  req.flash('success', 'Podcast has been updated with all episodes.');

  return redirect(req, res, `/content/podcast/${podcast.id}`);
};

// GET /content/video/edit/:id
export const videoEditHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid video ID');
    return redirect(req, res, '/404');
  }

  if (!req.user) {
    req.flash('danger', 'Please log in to edit videos.');
    return redirect(req, res, '/');
  }

  const video = await videoDao.getById(req.params.id);

  if (!video) {
    req.flash('danger', 'Video not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== video.owner.id) {
    req.flash('danger', 'Unauthorized: Only video owners can edit videos.');
    return redirect(req, res, `/content/video/${video.id}`);
  }

  if (video.status === ContentStatus.PUBLISHED) {
    req.flash('danger', 'Unauthorized: Videos cannot be editted after being published.');
    return redirect(req, res, `/content/video/${video.id}`);
  }

  return render(req, res, 'EditVideoPage', { video });
};

// POST /content/editarticle
export const editArticleHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to edit articles.');
    return redirect(req, res, '/');
  }

  const { articleid, title, imagename, body, short } = req.body;

  const article = await articleDao.getById(articleid);

  if (!article) {
    req.flash('danger', 'Article not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== article.owner.id) {
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

  await articleDao.update(article);

  return redirect(req, res, `/content/article/edit/${article.id}`);
};

// POST /content/editpodcast
export const editPodcastHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to edit podcasts.');
    return redirect(req, res, '/');
  }

  const { podcastid, rss } = req.body;

  const podcast = await podcastDao.getById(podcastid);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== podcast.owner.id) {
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
  (podcast as any).description = fields.description;
  (podcast as any).podcastLink = fields.url;
  (podcast as any).image = fields.image;

  await podcastDao.update(podcast);

  return redirect(req, res, `/content/podcast/edit/${podcast.id}`);
};

// POST /content/editvideo
export const editVideoHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to edit videos.');
    return redirect(req, res, '/');
  }

  const { videoid, title, imagename, body, url, short } = req.body;

  const video = await videoDao.getById(videoid);

  if (!video) {
    req.flash('danger', 'Video not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== video.owner.id) {
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

  await videoDao.update(video);

  return redirect(req, res, `/content/video/edit/${video.id}`);
};

// POST /content/submitarticle
export const submitArticleHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to submit articles.');
    return redirect(req, res, '/');
  }

  const { articleid, title, imagename, body, short } = req.body;

  const article = await articleDao.getById(articleid);

  if (!article) {
    req.flash('danger', 'Article not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== article.owner.id) {
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

  await articleDao.update(article);
  req.flash(
    'success',
    'Your article has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  return redirect(req, res, `/content/article/edit/${article.id}`);
};

// POST /content/submitpodcast
export const submitPodcastHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to submit podcasts.');
    return redirect(req, res, '/');
  }

  const { podcastid, rss } = req.body;

  const podcast = await podcastDao.getById(podcastid);

  if (!podcast) {
    req.flash('danger', 'Podcast not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== podcast.owner.id) {
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
  (podcast as any).description = fields.description;
  (podcast as any).podcastLink = fields.url;
  (podcast as any).image = fields.image;
  podcast.status = ContentStatus.IN_REVIEW;

  await podcastDao.update(podcast);
  req.flash(
    'success',
    'Your podcast has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  return redirect(req, res, `/content/podcast/edit/${podcast.id}`);
};

// POST /content/submitvideo
export const submitVideoHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to submit videos.');
    return redirect(req, res, '/');
  }

  const { videoid, title, imagename, body, url, short } = req.body;

  const video = await videoDao.getById(videoid);

  if (!video) {
    req.flash('danger', 'Video not found');
    return redirect(req, res, '/404');
  }

  if (req.user.id !== video.owner.id) {
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

  await videoDao.update(video);
  req.flash(
    'success',
    'Your video has been submitted for review. You can still submit changes before it is published. If you want to expedite this review, PM Dekkaru on Discord.',
  );

  return redirect(req, res, `/content/video/edit/${video.id}`);
};

// GET /content/newarticle
export const newArticleHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to create articles.');
    return redirect(req, res, '/');
  }

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

  const id = await articleDao.createArticle(article);

  return redirect(req, res, `/content/article/edit/${id}`);
};

// GET /content/newpodcast
export const newPodcastHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to create podcasts.');
    return redirect(req, res, '/');
  }

  const podcast = {
    title: 'New Podcast',
    owner: req.user.id,
    image:
      'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/d/e/decb78dd-03d7-43a0-8ff5-1b97c6f515c9.jpg?1580015192',
    date: new Date().valueOf(),
    status: ContentStatus.DRAFT,
    username: req.user.username,
    url: '',
  };

  const id = await podcastDao.createPodcast(podcast);

  return redirect(req, res, `/content/podcast/edit/${id}`);
};

// GET /content/newvideo
export const newVideoHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'Please log in to create videos.');
    return redirect(req, res, '/');
  }

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
    url: '',
  };

  const id = await videoDao.createVideo(video);

  return redirect(req, res, `/content/video/edit/${id}`);
};

// POST /content/getcreatorcontent
export const getCreatorContentHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).send({
      success: 'false',
      message: 'User not authenticated.',
    });
  }

  const { lastKey } = req.body;

  // lastKey is a dict with keys for each content type
  const articleLastKey = lastKey?.article;
  const videoLastKey = lastKey?.video;
  const podcastLastKey = lastKey?.podcast;
  const episodeLastKey = lastKey?.episode;

  // Query all four content types in parallel
  const [articlesResult, videosResult, podcastsResult, episodesResult] = await Promise.all([
    articleDao.queryByOwner(req.user.id, articleLastKey),
    videoDao.queryByOwner(req.user.id, videoLastKey),
    podcastDao.queryByOwner(req.user.id, podcastLastKey),
    episodeDao.queryByOwner(req.user.id, episodeLastKey),
  ]);

  // Merge and sort by date descending
  const allContent = [
    ...(articlesResult.items || []),
    ...(videosResult.items || []),
    ...(podcastsResult.items || []),
    ...(episodesResult.items || []),
  ].sort((a, b) => b.date - a.date);

  // Create a dictionary of last keys for each content type
  const newLastKey = {
    article: articlesResult.lastKey,
    video: videosResult.lastKey,
    podcast: podcastsResult.lastKey,
    episode: episodesResult.lastKey,
  };

  return res.status(200).send({
    success: 'true',
    content: allContent,
    lastKey: newLastKey,
  });
};

// POST /content/delete/:id
export const deleteHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid content ID',
      });
    }

    if (!req.user) {
      return res.status(401).send({
        success: 'false',
        message: 'User not authenticated.',
      });
    }

    // Try to find the content in each DAO
    const [article, video, podcast, episode] = await Promise.all([
      articleDao.getById(req.params.id),
      videoDao.getById(req.params.id),
      podcastDao.getById(req.params.id),
      episodeDao.getById(req.params.id),
    ]);

    const content = article || video || podcast || episode;

    if (!content) {
      return res.status(404).send({
        success: 'false',
        message: 'Content not found',
      });
    }

    // Verify the user owns the content
    const ownerId = typeof content.owner === 'string' ? content.owner : content.owner.id;
    if (req.user.id !== ownerId) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized: Only content owners can delete their content.',
      });
    }

    // Only allow deletion of unpublished content
    if (content.status === ContentStatus.PUBLISHED) {
      return res.status(403).send({
        success: 'false',
        message: 'Published content cannot be deleted.',
      });
    }

    // Delete the content using the appropriate DAO
    if (article) {
      await articleDao.delete(article);
    } else if (video) {
      await videoDao.delete(video);
    } else if (podcast) {
      await podcastDao.delete(podcast);
    } else if (episode) {
      await episodeDao.delete(episode);
    }

    return res.status(200).send({
      success: 'true',
      message: 'Content deleted successfully',
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'An error occurred while deleting the content',
    });
  }
};

export const routes = [
  {
    path: '/application',
    method: 'get',
    handler: [csrfProtection, ensureAuth, applicationHandler],
  },
  {
    path: '/submitapplication',
    method: 'post',
    handler: [csrfProtection, ensureAuth, submitApplicationHandler],
  },
  {
    path: '/creators',
    method: 'get',
    handler: [csrfProtection, ensureContentCreator, creatorsHandler],
  },
  {
    path: '/browse',
    method: 'get',
    handler: [csrfProtection, browseHandler],
  },
  {
    path: '/getmore',
    method: 'post',
    handler: [csrfProtection, getMoreHandler],
  },
  {
    path: '/articles',
    method: 'get',
    handler: [csrfProtection, articlesHandler],
  },
  {
    path: '/getmorearticles',
    method: 'post',
    handler: [csrfProtection, getMoreArticlesHandler],
  },
  {
    path: '/videos',
    method: 'get',
    handler: [csrfProtection, videosHandler],
  },
  {
    path: '/getmorevideos',
    method: 'post',
    handler: [csrfProtection, getMoreVideosHandler],
  },
  {
    path: '/podcasts',
    method: 'get',
    handler: [csrfProtection, podcastsHandler],
  },
  {
    path: '/getmorepodcasts',
    method: 'post',
    handler: [csrfProtection, getMorePodcastsHandler],
  },
  {
    path: '/a/:id',
    method: 'get',
    handler: [csrfProtection, aRedirectHandler],
  },
  {
    path: '/p/:id',
    method: 'get',
    handler: [csrfProtection, pRedirectHandler],
  },
  {
    path: '/v/:id',
    method: 'get',
    handler: [csrfProtection, vRedirectHandler],
  },
  {
    path: '/article/:id',
    method: 'get',
    handler: [csrfProtection, articleHandler],
  },
  {
    path: '/podcast/:id',
    method: 'get',
    handler: [csrfProtection, podcastHandler],
  },
  {
    path: '/episode/:id',
    method: 'get',
    handler: [csrfProtection, episodeHandler],
  },
  {
    path: '/video/:id',
    method: 'get',
    handler: [csrfProtection, videoHandler],
  },
  {
    path: '/article/edit/:id',
    method: 'get',
    handler: [csrfProtection, ensureContentCreator, articleEditHandler],
  },
  {
    path: '/podcast/edit/:id',
    method: 'get',
    handler: [csrfProtection, ensureContentCreator, podcastEditHandler],
  },
  {
    path: '/podcast/update/:id',
    method: 'get',
    handler: [csrfProtection, ensureContentCreator, podcastUpdateHandler],
  },
  {
    path: '/video/edit/:id',
    method: 'get',
    handler: [csrfProtection, ensureContentCreator, videoEditHandler],
  },
  {
    path: '/editarticle',
    method: 'post',
    handler: [csrfProtection, ensureContentCreator, editArticleHandler],
  },
  {
    path: '/editpodcast',
    method: 'post',
    handler: [csrfProtection, ensureContentCreator, editPodcastHandler],
  },
  {
    path: '/editvideo',
    method: 'post',
    handler: [csrfProtection, ensureContentCreator, editVideoHandler],
  },
  {
    path: '/submitarticle',
    method: 'post',
    handler: [csrfProtection, ensureContentCreator, submitArticleHandler],
  },
  {
    path: '/submitpodcast',
    method: 'post',
    handler: [csrfProtection, ensureContentCreator, submitPodcastHandler],
  },
  {
    path: '/submitvideo',
    method: 'post',
    handler: [csrfProtection, ensureContentCreator, submitVideoHandler],
  },
  {
    path: '/newarticle',
    method: 'get',
    handler: [csrfProtection, ensureContentCreator, newArticleHandler],
  },
  {
    path: '/newpodcast',
    method: 'get',
    handler: [csrfProtection, ensureContentCreator, newPodcastHandler],
  },
  {
    path: '/newvideo',
    method: 'get',
    handler: [csrfProtection, ensureContentCreator, newVideoHandler],
  },
  {
    path: '/getcreatorcontent',
    method: 'post',
    handler: [csrfProtection, ensureContentCreator, getCreatorContentHandler],
  },
  {
    path: '/delete/:id',
    method: 'post',
    handler: [csrfProtection, ensureContentCreator, deleteHandler],
  },
];
