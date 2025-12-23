import { cubeDao } from 'dynamo/daos';
import { compareCubes, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const compareHandler = async (req: Request, res: Response) => {
  try {
    const { idA, idB } = req.params;

    const cubeAq = cubeDao.getById(idA!);
    const cubeBq = cubeDao.getById(idB!);

    const [cubeA, cubeB] = await Promise.all([cubeAq, cubeBq]);

    if (!isCubeViewable(cubeA, req.user) || !cubeA) {
      req.flash('danger', `Base cube not found: ${idA}`);
      return redirect(req, res, '/404');
    }
    if (!isCubeViewable(cubeB, req.user) || !cubeB) {
      req.flash('danger', `Comparison cube not found: ${idB}`);
      return redirect(req, res, '/404');
    }

    const [cardsA, cardsB] = await Promise.all([cubeDao.getCards(cubeA.id), cubeDao.getCards(cubeB.id)]);

    const { aOracles, bOracles, inBoth, allCards } = await compareCubes(cardsA, cardsB);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeComparePage',
      {
        cube: cubeA,
        cubeB,
        onlyA: aOracles,
        onlyB: bOracles,
        both: inBoth.map((card: any) => card.details.oracle_id),
        cards: allCards.map((card: any, index: number) =>
          Object.assign(card, {
            index,
          }),
        ),
      },
      {
        title: `Comparing ${cubeA.name} to ${cubeB.name}`,
        metadata: generateMeta(
          'Cube Cobra Compare cubes',
          `Comparing "${cubeA.name}" To "${cubeB.name}"`,
          cubeA.image.uri,
          `${baseUrl}/cube/compare/${idA}/to/${idB}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    path: '/:idA/to/:idB',
    method: 'get',
    handler: [compareHandler],
  },
];
