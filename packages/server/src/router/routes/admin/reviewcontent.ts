import { ContentStatus } from '@utils/datatypes/Content';
import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { render } from 'serverutils/render';
import { articleDao, episodeDao, podcastDao, videoDao } from 'dynamo/daos';
import { Request, Response } from 'types/express';

export const reviewcontentHandler = async (req: Request, res: Response) => {
  // Query all content types in review in parallel
  const [articlesResult, videosResult, podcastsResult, episodesResult] = await Promise.all([
    articleDao.queryByStatus(ContentStatus.IN_REVIEW),
    videoDao.queryByStatus(ContentStatus.IN_REVIEW),
    podcastDao.queryByStatus(ContentStatus.IN_REVIEW),
    episodeDao.queryByStatus(ContentStatus.IN_REVIEW),
  ]);

  // Merge all content in review and sort by date descending
  const content = [
    ...(articlesResult.items || []),
    ...(videosResult.items || []),
    ...(podcastsResult.items || []),
    ...(episodesResult.items || []),
  ].sort((a, b) => b.date - a.date);

  return render(req, res, 'ReviewContentPage', { content });
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), reviewcontentHandler],
  },
];
