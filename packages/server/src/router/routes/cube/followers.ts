import { cubeDao, userDao } from 'dynamo/daos';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

const PAGE_SIZE = 36;

export const getFollowersPageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Cube ID required');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(req.params.id);
    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id);
    const followed = !!req.user && (await cubeDao.getLike(cube.id, req.user.id));

    const page = await cubeDao.queryLikersOfCube(cube.id, undefined, PAGE_SIZE);
    const followers = await userDao.batchGet(page.userIds);

    return render(
      req,
      res,
      'CubeFollowersPage',
      {
        cube: { ...cube, likedByCurrentUser: followed },
        cards,
        followers,
        lastKey: page.lastKey,
      },
      { title: `${abbreviate(cube.name)} - Followers` },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/list/${req.params.id}`);
  }
};

export const getMoreFollowersHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lastKey = req.body?.lastKey;
    if (!id) {
      return res.status(400).send({ success: 'false', message: 'cube id required' });
    }

    const cube = await cubeDao.getById(id);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({ success: 'false', message: 'Cube not found' });
    }

    const page = await cubeDao.queryLikersOfCube(cube.id, lastKey || undefined, PAGE_SIZE);
    const followers = await userDao.batchGet(page.userIds);

    return res.status(200).send({
      success: 'true',
      followers,
      lastKey: page.lastKey,
    });
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [getFollowersPageHandler],
  },
  {
    path: '/getmore/:id',
    method: 'post',
    handler: [getMoreFollowersHandler],
  },
];
