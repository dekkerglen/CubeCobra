import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../types/express';

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

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const baseUrl = getBaseUrl();
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
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [handler],
  },
];
