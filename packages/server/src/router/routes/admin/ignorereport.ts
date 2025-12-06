import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import Notice from 'dynamo/models/notice';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const ignorereportHandler = async (req: Request, res: Response) => {
  const report = await Notice.getById(req.params.id!);

  report.status = NoticeStatus.PROCESSED;
  await Notice.put(report);

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
