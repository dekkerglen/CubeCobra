import { NoticeStatus } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import Notice from 'dynamo/models/notice';
import User from 'dynamo/models/user';
import { csrfProtection, ensureRole } from 'router/middleware';
import sendEmail from 'serverutils/email';
import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const declineHandler = async (req: Request, res: Response) => {
  const application = await Notice.getById(req.params.id!);

  application.status = NoticeStatus.PROCESSED;
  Notice.put(application);

  //Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
  const applicationUser = await User.getByIdWithSensitiveData(application.user.id);

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
