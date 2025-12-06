import { ContentStatus, ContentType } from '@utils/datatypes/Content';
import Content from 'dynamo/models/content';
import Draft from 'dynamo/models/draft';

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

  const content = await Content.getByStatus(ContentStatus.PUBLISHED);

  const recentDecks = await Draft.queryByTypeAndDate(Draft.TYPES.DRAFT);

  // Get daily P1P1
  const dailyP1P1 = await getDailyP1P1(req.logger);

  return render(req, res, 'LandingPage', {
    featured,
    content: content.items?.filter((item: any) => item.type !== ContentType.PODCAST) || [],
    recentDecks: recentDecks.items.filter((deck: any) => deck.complete),
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
