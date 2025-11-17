import { UserRoles } from '@utils/datatypes/User';
import FeaturedQueue from 'dynamo/models/featuredQueue';
import User from 'dynamo/models/user';
import { csrfProtection, ensureRole } from 'routes/middleware';
import { redirect } from 'serverutils/render';
import util from 'serverutils/util';
import { Request, Response } from 'types/express';

export const unqueueHandler = async (req: Request, res: Response) => {
  if (!req.body.cubeId) {
    req.flash('danger', 'Cube ID not sent');
    return redirect(req, res, '/admin/featuredcubes');
  }

  const queuedCube = await FeaturedQueue.getByCube(req.body.cubeId);

  if (!queuedCube) {
    req.flash('danger', 'Cube not found in featured queue');
    return redirect(req, res, '/admin/featuredcubes');
  }

  await FeaturedQueue.delete(req.body.cubeId);

  const user = await User.getById(queuedCube.owner);
  if (user && req.user) {
    await util.addNotification(
      user,
      req.user,
      '/user/account?nav=patreon',
      'An admin removed your cube from the featured cubes queue.',
    );
  }
  return redirect(req, res, '/admin/featuredcubes');
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), unqueueHandler],
  },
];
