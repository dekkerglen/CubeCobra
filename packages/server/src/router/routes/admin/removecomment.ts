import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { commentDao, noticeDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const removecommentHandler = async (req: Request, res: Response) => {
  const report = await noticeDao.getById(req.params.id!);

  if (!report) {
    req.flash('danger', 'Report not found.');
    return redirect(req, res, '/admin/notices');
  }

  const comment = await commentDao.getById(report.subject!);

  report.status = NoticeStatus.PROCESSED;
  await noticeDao.put(report);

  if (comment) {
    comment.owner = undefined;
    comment.body = '[removed by moderator]';
    // the -1000 is to prevent weird time display error
    comment.date = Date.now() - 1000;
    await commentDao.put(comment);
  }

  req.flash('success', 'This comment has been deleted.');
  return redirect(req, res, '/admin/notices');
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), removecommentHandler],
  },
];
