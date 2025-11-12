import DraftType from '@utils/datatypes/Draft';
import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import { csrfProtection } from 'routes/middleware';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import util from 'serverutils/util';

import { Request, Response } from '../../../types/express';

const handler = async (req: Request, res: Response) => {
  try {
    const deck: DraftType = await Draft.getById(req.params.id);
    if (!deck) {
      req.flash('danger', 'Deck not found');
      return redirect(req, res, '/404');
    }

    if (!req.user) {
      return res.status(401).send({
        success: false,
        message: 'You must be logged in to finish a draft',
      });
    }

    if (typeof deck.owner !== 'string' && deck.owner?.id !== req.user.id) {
      return res.status(401).send({
        success: false,
        message: 'You do not own this draft',
      });
    }

    const cube = await Cube.getById(deck.cube);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const baseUrl = util.getBaseUrl();
    return render(
      req,
      res,
      'CubeDeckbuilderPage',
      {
        cube,
        initialDeck: deck,
      },
      {
        title: `${abbreviate(cube.name)} - Deckbuilder`,
        metadata: generateMeta(
          `Cube Cobra Draft: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/draft/deckbuilder/${req.params.id}`,
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
