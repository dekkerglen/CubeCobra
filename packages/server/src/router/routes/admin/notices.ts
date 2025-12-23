import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { noticeDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const noticesHandler = async (req: Request, res: Response) => {
  const notices = await noticeDao.getByStatus(NoticeStatus.ACTIVE);
  return render(req, res, 'NoticePage', { notices: notices.items });
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), noticesHandler],
  },
];
