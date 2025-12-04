import Cube from 'dynamo/models/cube';
import Patron from 'dynamo/models/patron';
import * as fq from 'serverutils/featuredQueue';
import { redirect } from 'serverutils/render';
import { csrfProtection, ensureAuth } from 'src/router/middleware';
import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  const redirectTo = '/user/account?nav=patreon&tab=4';

  if (!req.user) {
    req.flash('danger', 'User not authenticated');
    return redirect(req, res, redirectTo);
  }

  if (!req.body.cubeId) {
    req.flash('danger', 'Cube ID not sent');
    return redirect(req, res, redirectTo);
  }

  const cube = await Cube.getById(req.body.cubeId);
  if (!cube) {
    req.flash('danger', 'Cube not found');
    return redirect(req, res, redirectTo);
  }
  if (cube.owner.id !== req.user.id) {
    req.flash('danger', 'Only an owner of a cube can add it to the queue');
    return redirect(req, res, redirectTo);
  }

  if (cube.visibility === (Cube as any).VISIBILITY.PRIVATE) {
    req.flash('danger', 'Private cubes cannot be featured');
    return redirect(req, res, redirectTo);
  }

  const patron = await Patron.getById(req.user.id);
  if (!fq.canBeFeatured(patron)) {
    req.flash('danger', 'Insufficient Patreon status for featuring a cube');
    return redirect(req, res, redirectTo);
  }

  const shouldUpdate = await fq.doesUserHaveFeaturedCube(req.user.id);

  try {
    if (shouldUpdate) {
      await fq.replaceForUser(req.user.id, cube.id);
      req.flash('success', 'Successfully replaced cube in queue');
    } else {
      await fq.addNewCubeToQueue(req.user.id, cube.id);
      req.flash('success', 'Successfully added cube to queue');
    }
  } catch (err) {
    req.flash('danger', (err as Error).message);
  }

  return redirect(req, res, redirectTo);
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
