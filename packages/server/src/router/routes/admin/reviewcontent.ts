import { ContentStatus } from '@utils/datatypes/Content';
import { UserRoles } from '@utils/datatypes/User';
import { articleDao, episodeDao, podcastDao, videoDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirectToAdminTab } from 'serverutils/adminDashboard';
import { Request, Response } from 'types/express';

export const reviewcontentDataHandler = async (req: Request, res: Response) => {
  try {
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

    return res.status(200).json({ success: true, content });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), redirectToAdminTab('reviewcontent')],
  },
  {
    method: 'get',
    path: '/data',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), reviewcontentDataHandler],
  },
];
