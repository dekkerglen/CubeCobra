import { ContentStatus } from '@utils/datatypes/Content';
import { UserRoles } from '@utils/datatypes/User';
import Content from 'dynamo/models/content';
import User from 'dynamo/models/user';
import { csrfProtection, ensureRole } from 'routes/middleware';
import sendEmail from 'serverutils/email';
import { redirect } from 'serverutils/render';
import { addNotification, getBaseUrl } from 'serverutils/util';
import { Request, Response } from 'types/express';

export const publishHandler = async (req: Request, res: Response) => {
  const document = await Content.getById(req.params.id!);

  if (document.status !== ContentStatus.IN_REVIEW) {
    req.flash('danger', `Content not in review`);
    return redirect(req, res, '/admin/reviewcontent');
  }

  document.status = ContentStatus.PUBLISHED;
  document.date = new Date().valueOf();

  await Content.update(document);

  if (document.owner && req.user) {
    await addNotification(
      document.owner,
      req.user,
      `/content/${document.type}/${document.id}`,
      `${req.user.username} has approved and published your content: ${document.title}`,
    );

    //Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
    const owner = await User.getByIdWithSensitiveData(document.owner.id);

    if (owner) {
      const baseUrl = getBaseUrl();
      await sendEmail(owner.email, 'Your content has been published', 'content_publish', {
        title: document.title,
        url: `${baseUrl}/content/${document.type}/${document.id}`,
      });
    }
  }

  req.flash('success', `Content published: ${document.title}`);

  return redirect(req, res, '/admin/reviewcontent');
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), publishHandler],
  },
];
