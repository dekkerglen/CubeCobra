import miscutil from '@utils/Util';
import { cubeDao } from 'dynamo/daos';
import { cardFromId } from 'serverutils/carddb';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const analysisHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id);
    const tokenMap: Record<string, any> = {};

    for (const [boardname, list] of Object.entries(cards)) {
      if (boardname !== 'id') {
        for (const card of list as any[]) {
          if (card.details.tokens) {
            for (const oracle of card.details.tokens) {
              const tokenDetails = cardFromId(oracle);
              tokenMap[oracle] = {
                tags: [],
                status: 'Not Owned',
                colors: tokenDetails.color_identity,
                cmc: tokenDetails.cmc,
                cardID: tokenDetails.scryfall_id,
                type_line: tokenDetails.type,
                addedTmsp: new Date(),
                finish: 'Non-foil',
                details: tokenDetails,
              };
            }
          }
        }
      }
    }

    const cubeAnalytics = await cubeDao.getAnalytics(cube.id);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeAnalysisPage',
      {
        cube,
        cards,
        tokenMap,
        cubeAnalytics: cubeAnalytics || { cards: [] },
        cubeID: req.params.id,
      },
      {
        metadata: generateMeta(
          `Cube Cobra Analysis: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image.uri,
          `${baseUrl}/cube/analysis/${req.params.id}`,
        ),
        title: `${abbreviate(cube.name)} - Analysis`,
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/primer/${req.params.id}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [analysisHandler],
  },
];
