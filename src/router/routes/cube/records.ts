import Cube from '../../../dynamo/models/cube';
import Record from '../../../dynamo/models/record';
import recordAnalytic from '../../../dynamo/models/recordAnalytic';
import { csrfProtection } from '../../../routes/middleware';
import { Request, Response } from '../../../types/express';
import { abbreviate, isCubeViewable } from '../../../util/cubefn';
import generateMeta from '../../../util/meta';
import { handleRouteError, redirect, render } from '../../../util/render';
import util from '../../../util/util';

export const recordsPageHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const result = await Record.getByCube(cube.id, 20);
    const analytics = await recordAnalytic.getByCube(cube.id);
    const cards = await Cube.getCards(cube.id);

    const baseUrl = util.getBaseUrl();
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
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, recordsPageHandler],
  },
];
