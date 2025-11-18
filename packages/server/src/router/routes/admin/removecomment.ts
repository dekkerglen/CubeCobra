import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { commentDao } from 'dynamo/daos';
import Notice from 'dynamo/models/notice';
import { csrfProtection, ensureRole } from 'routes/middleware';
import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const removecommentHandler = async (req: Request, res: Response) => {
  const report = await Notice.getById(req.params.id!);
  const comment = await commentDao.getById(report.subject!);

  report.status = NoticeStatus.PROCESSED;
  await Notice.put(report);

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
