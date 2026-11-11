import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { noticeDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirectToAdminTab } from 'serverutils/adminDashboard';
import { Request, Response } from 'types/express';

export const noticesDataHandler = async (req: Request, res: Response) => {
  try {
    const notices = await noticeDao.getByStatus(NoticeStatus.ACTIVE);
    return res.status(200).json({ success: true, notices: notices.items });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), redirectToAdminTab('notices')],
  },
  {
    method: 'get',
    path: '/data',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), noticesDataHandler],
  },
];
