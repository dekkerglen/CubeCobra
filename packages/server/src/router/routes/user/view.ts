import { cubeDao, userDao } from 'dynamo/daos';
import { isCubeListed } from 'serverutils/cubefn';
import { getCubesSortValues, handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'User ID required');
      return redirect(req, res, '/404');
    }

    const user = await userDao.getByIdOrUsername(req.params.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const { sort, ascending } = getCubesSortValues(user);

    const cubes = (await cubeDao.queryByOwner(user.id, sort, ascending)).items.filter((cube: any) =>
      isCubeListed(cube, req.user),
    );

    const following = req.user && user.following && user.following.some((id) => id === req.user?.id);

    return render(req, res, 'UserCubePage', {
      owner: user,
      cubes,
      followersCount: (user.following || []).length,
      following,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [handler],
  },
];
