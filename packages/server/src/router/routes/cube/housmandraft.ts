import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { cubeDao, draftDao } from 'dynamo/daos';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const housmanDraftHandler = async (req: Request, res: Response) => {
  try {
    const document = await draftDao.getById(req.params.id!);

    if (!document) {
      req.flash('danger', 'Draft not found');
      return redirect(req, res, '/404');
    }

    if (document.type !== DRAFT_TYPES.HOUSMAN) {
      req.flash('danger', 'Draft is not a housman draft');
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
      'HousmanDraftPage',
      {
        cube,
        initialDraft: document,
      },
      {
        title: `${abbreviate(cube.name)} - Housman Draft`,
        metadata: generateMeta(
          `Cube Cobra Housman Draft: ${cube.name}`,
          cube.brief,
          cube.image.uri,
          `${baseUrl}/cube/housmandraft/${req.params.id}`,
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
    handler: [housmanDraftHandler],
  },
];
