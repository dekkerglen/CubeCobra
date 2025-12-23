import { UserRoles } from '@utils/datatypes/User';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { addNewCubeToQueue } from 'serverutils/featuredQueue';
import { redirect } from 'serverutils/render';
import { addNotification } from 'serverutils/util';
import { Request, Response } from 'types/express';

export const queueHandler = async (req: Request, res: Response) => {
  if (!req.body.cubeId) {
    req.flash('danger', 'Cube ID not sent');
    return redirect(req, res, '/admin/featuredcubes');
  }
  const cube = await cubeDao.getById(req.body.cubeId);
  if (!cube) {
    req.flash('danger', 'Cube does not exist');
    return redirect(req, res, '/admin/featuredcubes');
  }

  if (cube.visibility === 'pr') {
    req.flash('danger', 'Cannot feature private cube');
    return redirect(req, res, '/admin/featuredcubes');
  }

  await addNewCubeToQueue(cube.owner.id, cube.id);

  if (req.user) {
    await addNotification(
      cube.owner,
      req.user,
      '/user/account?nav=patreon',
      'An admin added your cube to the featured cubes queue.',
    );
  }
  return redirect(req, res, '/admin/featuredcubes');
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), queueHandler],
  },
];
