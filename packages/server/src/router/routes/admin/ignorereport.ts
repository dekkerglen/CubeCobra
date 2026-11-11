import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { noticeDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { adminTabUrl } from 'serverutils/adminDashboard';
import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const ignorereportHandler = async (req: Request, res: Response) => {
  const report = await noticeDao.getById(req.params.id!);

  if (!report) {
    req.flash('danger', 'Report not found.');
    return redirect(req, res, adminTabUrl('notices'));
  }

  report.status = NoticeStatus.PROCESSED;
  await noticeDao.update(report);

  req.flash('success', 'This report has been ignored.');
  return redirect(req, res, adminTabUrl('notices'));
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), ignorereportHandler],
  },
];
