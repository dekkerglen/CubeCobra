import { cubeDao, draftDao } from 'dynamo/daos';
import p1p1PackModel from 'dynamo/models/p1p1Pack';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const playtestHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const decks = await draftDao.queryByCube(cube.id);

    // Get previous P1P1 packs for this cube
    let previousPacks: any[] = [];
    let previousPacksLastKey: any = null;
    try {
      const previousPacksResult = await p1p1PackModel.queryByCube(cube.id, undefined, 10);
      previousPacks = previousPacksResult.items || [];
      previousPacksLastKey = previousPacksResult.lastKey;
    } catch (error) {
      // If we can't get previous packs, just continue without them
      req.logger.error('Failed to fetch previous P1P1 packs:', error);
    }

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubePlaytestPage',
      {
        cube,
        decks: decks.items,
        decksLastKey: (decks as any).lastKey || null,
        previousPacks,
        previousPacksLastKey,
      },
      {
        title: `${abbreviate(cube.name)} - Playtest`,
        metadata: generateMeta(
          `Cube Cobra Playtest: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/playtest/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/overview/${req.params.id}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [playtestHandler],
  },
];
