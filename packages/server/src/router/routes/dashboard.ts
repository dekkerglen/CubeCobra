import { ContentStatus } from '@utils/datatypes/Content';
import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import { feedDao } from 'dynamo/daos';
import { articleDao, draftDao, episodeDao, videoDao } from 'dynamo/daos';
import { getDailyP1P1 } from 'serverutils/dailyP1P1';
import { getFeaturedCubes } from 'serverutils/featuredQueue';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../types/express';
import { csrfProtection, ensureAuth } from '../middleware';

// Helper function to filter feed items based on cube privacy
const filterFeedItemsByPrivacy = (feedItems: any[], userId?: string): any[] => {
  return feedItems.filter((item) => {
    const blog = item.document;
    if (!blog) return false;

    // DEVLOG posts are always visible
    if (blog.cube === 'DEVBLOG') {
      return true;
    }

    // If the cube is private, only show to the owner
    if (blog.cubeVisibility === CUBE_VISIBILITY.PRIVATE) {
      return userId && userId === blog.owner.id;
    }

    // All other cubes (public, unlisted) are visible
    return true;
  });
};

const dashboardHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return redirect(req, res, '/landing');
    }

    const posts = await feedDao.getByTo(req.user.id);

    // Filter out blog posts from private cubes that the user doesn't own
    const filteredPosts = filterFeedItemsByPrivacy(posts.items || [], req.user.id);

    const featured = await getFeaturedCubes();

    // Query all content types in parallel (excluding podcasts, only episodes)
    const [articlesResult, videosResult, episodesResult] = await Promise.all([
      articleDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 36),
      videoDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 36),
      episodeDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 36),
    ]);

    // Merge and sort by date descending
    const content = [...(articlesResult.items || []), ...(videosResult.items || []), ...(episodesResult.items || [])]
      .sort((a, b) => b.date - a.date)
      .slice(0, 36);

    // Use unhydrated query to avoid loading cards/seats from S3 for better performance
    const decks = await draftDao.queryByCubeOwnerUnhydrated(req.user.id);

    // Get daily P1P1
    const dailyP1P1 = await getDailyP1P1(req.logger);

    return render(req, res, 'DashboardPage', {
      posts: filteredPosts.map((item: any) => item.document),
      lastKey: posts.lastKey,
      decks: decks.items,
      lastDeckKey: decks.lastKey,
      content,
      featured,
      dailyP1P1,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/landing');
  }
};

const getMoreFeedItemsHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).send({ success: 'false', message: 'Unauthorized' });
  }

  const { lastKey } = req.body;
  const { user } = req;

  const result = await feedDao.getByTo(user.id, lastKey);

  // Filter out blog posts from private cubes that the user doesn't own
  const filteredItems = filterFeedItemsByPrivacy(result.items || [], user.id);

  return res.status(200).send({
    success: 'true',
    items: filteredItems.map((item: any) => item.document),
    lastKey: result.lastKey,
  });
};

const getMoreDecksHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).send({ success: 'false', message: 'Unauthorized' });
  }

  const { lastKey } = req.body;

  // Use unhydrated query to avoid loading cards/seats from S3 for better performance
  const result = await draftDao.queryByCubeOwnerUnhydrated(req.user.id, lastKey);

  return res.status(200).send({
    success: 'true',
    items: result.items,
    lastKey: result.lastKey,
  });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [csrfProtection, ensureAuth, dashboardHandler],
  },
  {
    path: '/getmorefeeditems',
    method: 'post',
    handler: [csrfProtection, ensureAuth, getMoreFeedItemsHandler],
  },
  {
    path: '/getmoredecks',
    method: 'post',
    handler: [csrfProtection, ensureAuth, getMoreDecksHandler],
  },
];
