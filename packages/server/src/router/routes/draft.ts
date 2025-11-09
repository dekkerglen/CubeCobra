import generateMeta from 'serverutils/meta';
import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import { csrfProtection } from 'routes/middleware';
import { Request, Response } from '../../types/express';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import util from 'serverutils/util';
const { handleRouteError, redirect, render } = require('serverutils/render');

const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid draft ID');
      return redirect(req, res, '/404');
    }

    const draft = await Draft.getById(req.params.id);

    if (!draft) {
      req.flash('danger', 'Draft not found');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(draft.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const baseUrl = util.getBaseUrl();
    return render(
      req,
      res,
      'CubeDraftPage',
      {
        cube,
        draft,
      },
      {
        title: `${abbreviate(cube.name)} - Draft`,
        metadata: generateMeta(
          `Cube Cobra Draft: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/draft/${encodeURIComponent(req.params.id!)}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [csrfProtection, handler],
  },
];
