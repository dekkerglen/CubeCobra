import { cubeDao, recordDao } from 'dynamo/daos';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const recordsPageHandler = async (req: Request, res: Response) => {
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

    const result = await recordDao.getByCube(cube.id, 20);
    const analytics = await recordDao.getAnalytics(cube.id);
    const cards = await cubeDao.getCards(cube.id);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeRecordsPage',
      {
        cube,
        cards,
        records: result.items,
        lastKey: result.lastKey,
        analyticsData: analytics,
      },
      {
        title: `${abbreviate(cube.name)} - Records`,
        metadata: generateMeta(
          `Cube Cobra Records: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/records/${req.params.id}`,
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
    handler: [recordsPageHandler],
  },
];
