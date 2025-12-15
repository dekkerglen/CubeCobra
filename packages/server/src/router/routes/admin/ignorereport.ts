import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirect } from 'serverutils/render';
import { noticeDao } from 'dynamo/daos';
import { Request, Response } from 'types/express';

export const ignorereportHandler = async (req: Request, res: Response) => {
  const report = await noticeDao.getById(req.params.id!);

  if (!report) {
    req.flash('danger', 'Report not found.');
    return redirect(req, res, '/admin/notices');
  }

  report.status = NoticeStatus.PROCESSED;
  await noticeDao.put(report);

  req.flash('success', 'This report has been ignored.');
  return redirect(req, res, '/admin/notices');
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), ignorereportHandler],
  },
];
