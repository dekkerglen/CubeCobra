import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { noticeDao, userDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import sendEmail from 'serverutils/email';
import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const approveHandler = async (req: Request, res: Response) => {
  const application = await noticeDao.getById(req.params.id!);

  if (!application) {
    req.flash('danger', 'Application not found.');
    return redirect(req, res, '/admin/notices');
  }

  if (!application.user.roles) {
    application.user.roles = [];
  }
  if (!application.user.roles.includes(UserRoles.CONTENT_CREATOR)) {
    application.user.roles.push(UserRoles.CONTENT_CREATOR);
  }

  //Normal hydration of User does not contain email, thus we must fetch it with sensitive data before updating
  const userToUpdate = await userDao.getByIdWithSensitiveData(application.user.id);
  if (userToUpdate) {
    userToUpdate.roles = application.user.roles;
    await userDao.update(userToUpdate as any);
  }

  //Fetch again to send notification email
  const applicationUser = await userDao.getByIdWithSensitiveData(application.user.id);

  application.status = NoticeStatus.PROCESSED;
  await noticeDao.update(application);

  if (applicationUser) {
    await sendEmail(applicationUser.email, 'Cube Cobra Content Creator', 'application_approve');
  }

  req.flash('success', `Application for ${application.user.username} approved.`);
  return redirect(req, res, `/admin/notices`);
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), approveHandler],
  },
];
