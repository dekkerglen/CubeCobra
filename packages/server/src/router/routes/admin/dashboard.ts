// Load Environment Variables
import { ContentStatus } from '@utils/datatypes/Content';
import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import Content from 'dynamo/models/content';
import Notice from 'dynamo/models/notice';
import { csrfProtection, ensureRole } from 'routes/middleware';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const dashboardHandler = async (req: Request, res: Response) => {
  const noticeCount = await Notice.getByStatus(NoticeStatus.ACTIVE);
  const contentInReview = await Content.getByStatus(ContentStatus.IN_REVIEW);

  return render(req, res, 'AdminDashboardPage', {
    noticeCount: noticeCount.items?.length || 0,
    contentInReview: contentInReview.items?.length || 0,
  });
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), dashboardHandler],
  },
];
