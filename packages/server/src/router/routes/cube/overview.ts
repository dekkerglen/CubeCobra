import { cubeDao } from 'dynamo/daos';
import { getCubeId } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const overviewHandler = async (req: Request, res: Response) => {
  // Redirect to primer page for backwards compatibility
  const cube = await cubeDao.getById(req.params.id!);
  const cubeId = cube ? getCubeId(cube) : req.params.id;
  return redirect(req, res, `/cube/about/${encodeURIComponent(cubeId!)}?view=primer`);
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [overviewHandler],
  },
];
