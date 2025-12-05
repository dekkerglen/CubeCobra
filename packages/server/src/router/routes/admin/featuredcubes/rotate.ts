import { UserRoles } from '@utils/datatypes/User';
import User from 'dynamo/models/user';
import { csrfProtection, ensureRole } from 'routes/middleware';
import { rotateFeatured } from 'serverutils/featuredQueue';
import { redirect } from 'serverutils/render';
import { addNotification } from 'serverutils/util';
import { Request, Response } from 'types/express';

export const rotateHandler = async (req: Request, res: Response) => {
  const rotate = await rotateFeatured();
  for (const message of rotate.messages) {
    req.flash('danger', message);
  }

  if (rotate.success === 'false') {
    req.flash('danger', 'featured Cube rotation failed!');
    return redirect(req, res, '/admin/featuredcubes');
  }

  const olds = await User.batchGet(rotate.removed.map((f: any) => f.ownerID));
  const news = await User.batchGet(rotate.added.map((f: any) => f.ownerID));
  const notifications = [];
  if (req.user) {
    for (const old of olds) {
      notifications.push(
        addNotification(old, req.user, '/user/account?nav=patreon', 'Your cube is no longer featured.'),
      );
    }
    for (const newO of news) {
      notifications.push(addNotification(newO, req.user, '/user/account?nav=patreon', 'Your cube has been featured!'));
    }
  }
  await Promise.all(notifications);
  return redirect(req, res, '/admin/featuredcubes');
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), rotateHandler],
  },
];
