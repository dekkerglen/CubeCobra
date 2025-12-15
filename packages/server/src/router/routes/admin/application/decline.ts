import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { noticeDao, userDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import sendEmail from 'serverutils/email';
import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const declineHandler = async (req: Request, res: Response) => {
  const application = await noticeDao.getById(req.params.id!);

  if (!application) {
    req.flash('danger', 'Application not found.');
    return redirect(req, res, '/admin/notices');
  }

  application.status = NoticeStatus.PROCESSED;
  noticeDao.put(application);

  //Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
  const applicationUser = await userDao.getByIdWithSensitiveData(application.user.id);

  if (applicationUser) {
    await sendEmail(applicationUser.email, 'Cube Cobra Content Creator', 'application_decline');
  }

  req.flash('danger', `Application declined.`);
  return redirect(req, res, `/admin/notices`);
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), declineHandler],
  },
];
