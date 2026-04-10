import { cubeDao } from 'dynamo/daos';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

const draftsimulatorHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeDraftSimulatorPage',
      { cube },
      {
        title: `${abbreviate(cube.name)} - Draft Simulator`,
        metadata: generateMeta(
          `Cube Cobra Draft Simulator: ${cube.name}`,
          `Bot draft simulation and analysis for ${cube.name}`,
          cube.image.uri,
          `${baseUrl}/cube/draftsimulator/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/list/${req.params.id}`);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [draftsimulatorHandler],
  },
];
