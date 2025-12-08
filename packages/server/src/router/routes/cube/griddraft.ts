import { cubeDao } from 'dynamo/daos';
import Draft from 'dynamo/models/draft';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const gridDraftHandler = async (req: Request, res: Response) => {
  try {
    const document = await Draft.getById(req.params.id!);

    if (!document) {
      req.flash('danger', 'Draft not found');
      return redirect(req, res, '/404');
    }

    if (document.type !== Draft.TYPES.GRID) {
      req.flash('danger', 'Draft is not a grid draft');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(document.cube);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'GridDraftPage',
      {
        cube,
        initialDraft: document,
      },
      {
        title: `${abbreviate(cube.name)} - Grid Draft`,
        metadata: generateMeta(
          `Cube Cobra Grid Draft: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/griddraft/${req.params.id}`,
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
    method: 'get' as const,
    handler: [gridDraftHandler],
  },
];
