import { ContentStatus } from '@utils/datatypes/Content';
import Draft from 'dynamo/models/draft';
import Feed from 'dynamo/models/feed';
import { getDailyP1P1 } from 'serverutils/dailyP1P1';
import { getFeaturedCubes } from 'serverutils/featuredQueue';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { articleDao, episodeDao, videoDao } from 'dynamo/daos';

import { Request, Response } from '../../types/express';
import { csrfProtection, ensureAuth } from '../middleware';

const dashboardHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return redirect(req, res, '/landing');
    }

    const posts = await Feed.getByTo(req.user.id);

    const featured = await getFeaturedCubes();

    // Query all content types in parallel (excluding podcasts, only episodes)
    const [articlesResult, videosResult, episodesResult] = await Promise.all([
      articleDao.queryByStatus(ContentStatus.PUBLISHED),
      videoDao.queryByStatus(ContentStatus.PUBLISHED),
      episodeDao.queryByStatus(ContentStatus.PUBLISHED),
    ]);

    // Merge and sort by date descending
    const content = [
      ...(articlesResult.items || []),
      ...(videosResult.items || []),
      ...(episodesResult.items || []),
    ].sort((a, b) => b.date - a.date);

    const decks = await Draft.getByCubeOwner(req.user.id);

    // Get daily P1P1
    const dailyP1P1 = await getDailyP1P1(req.logger);

    return render(req, res, 'DashboardPage', {
      posts: posts.items?.map((item: any) => item.document) || [],
      lastKey: posts.lastKey,
      decks: decks.items,
      lastDeckKey: decks.lastEvaluatedKey,
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

  const result = await Feed.getByTo(user.id, lastKey);

  return res.status(200).send({
    success: 'true',
    items: result.items?.map((item: any) => item.document) || [],
    lastKey: result.lastKey,
  });
};

const getMoreDecksHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).send({ success: 'false', message: 'Unauthorized' });
  }

  const { lastKey } = req.body;

  const result = await Draft.getByCubeOwner(req.user.id, lastKey);

  return res.status(200).send({
    success: 'true',
    items: result.items,
    lastKey: result.lastEvaluatedKey,
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
