import Cube from 'dynamo/models/cube';
import { abbreviate, generateBalancedPack, generatePack, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;

export const samplePackRedirectHandler = (req: Request, res: Response) => {
  const queryString = req.query.balanced === 'true' ? '?balanced=true' : '';
  return redirect(
    req,
    res,
    `/cube/samplepack/${encodeURIComponent(req.params.id!)}/${Date.now().toString()}${queryString}`,
  );
};

export const samplePackHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/playtest/404');
    }

    const cards = await Cube.getCards(cube.id);
    const isBalanced = req.query.balanced === 'true';

    let pack: any;
    let maxBotWeight: number | undefined;
    try {
      if (isBalanced) {
        const result = await generateBalancedPack(cube, cards, req.params.seed!, 10, null);
        pack = result.packResult;
        maxBotWeight = result.maxBotWeight;
      } else {
        pack = await generatePack(cube, cards, req.params.seed!);
      }
    } catch (err) {
      req.flash('danger', `Failed to generate pack: ${(err as Error).message}`);
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
    }

    const width = Math.floor(Math.sqrt((5 / 3) * pack.pack.length));
    const height = Math.ceil(pack.pack.length / width);

    const baseUrl = getBaseUrl();
    const queryString = isBalanced ? '?balanced=true' : '';
    return render(
      req,
      res,
      'CubeSamplePackPage',
      {
        seed: pack.seed,
        pack: pack.pack,
        cube,
        isBalanced,
        maxBotWeight,
      },
      {
        title: `${abbreviate(cube.name)} - ${isBalanced ? 'Balanced ' : ''}Sample Pack`,
        metadata: generateMeta(
          `Cube Cobra ${isBalanced ? 'Balanced ' : ''}Sample Pack`,
          `A ${isBalanced ? 'balanced ' : ''}sample pack from ${cube.name}`,
          `${baseUrl}/cube/samplepackimage/${req.params.id}/${pack.seed}.png${queryString}`,
          `${baseUrl}/cube/samplepack/${req.params.id}/${pack.seed}${queryString}`,
          CARD_WIDTH * width,
          CARD_HEIGHT * height,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/playtest/${req.params.id}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [samplePackRedirectHandler],
  },
  {
    path: '/:id/:seed',
    method: 'get',
    handler: [samplePackHandler],
  },
];
