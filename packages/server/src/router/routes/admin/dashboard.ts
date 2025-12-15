// Load Environment Variables
import { ContentStatus } from '@utils/datatypes/Content';
import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { render } from 'serverutils/render';
import { articleDao, episodeDao, podcastDao, videoDao, noticeDao } from 'dynamo/daos';
import { Request, Response } from 'types/express';

export const dashboardHandler = async (req: Request, res: Response) => {
  const noticeCount = await noticeDao.getByStatus(NoticeStatus.ACTIVE);

  // Query all content types in review in parallel
  const [articlesResult, videosResult, podcastsResult, episodesResult] = await Promise.all([
    articleDao.queryByStatus(ContentStatus.IN_REVIEW),
    videoDao.queryByStatus(ContentStatus.IN_REVIEW),
    podcastDao.queryByStatus(ContentStatus.IN_REVIEW),
    episodeDao.queryByStatus(ContentStatus.IN_REVIEW),
  ]);

  // Merge all content in review
  const contentInReview = [
    ...(articlesResult.items || []),
    ...(videosResult.items || []),
    ...(podcastsResult.items || []),
    ...(episodesResult.items || []),
  ];

  return render(req, res, 'AdminDashboardPage', {
    noticeCount: noticeCount.items?.length || 0,
    contentInReview: contentInReview.length,
  });
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), dashboardHandler],
  },
];
