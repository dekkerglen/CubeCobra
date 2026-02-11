import { ContentStatus } from '@utils/datatypes/Content';
import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { articleDao, draftDao, episodeDao, videoDao } from 'dynamo/daos';
import { getDailyP1P1 } from 'serverutils/dailyP1P1';
import { getFeaturedCubes } from 'serverutils/featuredQueue';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

const landingHandler = async (req: Request, res: Response) => {
  // If user is logged in, redirect to dashboard
  if (req.user) {
    return redirect(req, res, '/dashboard');
  }

  const featured = await getFeaturedCubes();

  // Query all content types in parallel (excluding podcasts, only episodes)
  const [articlesResult, videosResult, episodesResult] = await Promise.all([
    articleDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 24),
    videoDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 24),
    episodeDao.queryByStatus(ContentStatus.PUBLISHED, undefined, 24),
  ]);

  // Merge and sort by date descending
  const content = [...(articlesResult.items || []), ...(videosResult.items || []), ...(episodesResult.items || [])]
    .sort((a, b) => b.date - a.date)
    .slice(0, 36);

  const recentDecks = await draftDao.queryByTypeAndDate(DRAFT_TYPES.DRAFT, undefined, 50);

  // Get daily P1P1
  const dailyP1P1 = await getDailyP1P1(req.logger);

  return render(req, res, 'LandingPage', {
    featured,
    content,
    recentDecks: recentDecks.items.filter((deck: any) => deck.complete).slice(0, 12),
    dailyP1P1,
  });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [landingHandler],
  },
];
