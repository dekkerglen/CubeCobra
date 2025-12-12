import { UserRoles } from '@utils/datatypes/User';
import User from 'dynamo/models/user';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirect } from 'serverutils/render';
import { addNotification } from 'serverutils/util';
import { Request, Response } from 'types/express';
import { featuredQueueDao } from 'dynamo/daos';

export const unqueueHandler = async (req: Request, res: Response) => {
  if (!req.body.cubeId) {
    req.flash('danger', 'Cube ID not sent');
    return redirect(req, res, '/admin/featuredcubes');
  }

  const queuedCube = await featuredQueueDao.getByCube(req.body.cubeId);

  if (!queuedCube) {
    req.flash('danger', 'Cube not found in featured queue');
    return redirect(req, res, '/admin/featuredcubes');
  }

  await featuredQueueDao.delete(queuedCube);

  const user = await User.getById(queuedCube.owner);
  if (user && req.user) {
    await addNotification(
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
