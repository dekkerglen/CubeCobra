import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';
import { noticeDao } from 'dynamo/daos';

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
