import Cube from 'dynamo/models/cube';
import { generatePack, isCubeViewable } from 'serverutils/cubefn';
import { Request, Response } from '../../../../types/express';

export const p1p1Handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    const cubeCards = await Cube.getCards(req.params.id);

    const result = await generatePack(cube, cubeCards);

    return res.status(200).send({
      seed: result.seed,
      pack: result.pack.map((card: any) => card.name),
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error generating pack',
    });
  }
};

export const p1p1SeedHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.seed) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID and seed are required',
      });
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    const cubeCards = await Cube.getCards(req.params.id);

    const result = await generatePack(cube, cubeCards, req.params.seed);

    return res.status(200).send({
      seed: req.params.seed,
      pack: result.pack.map((card: any) => card.name),
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error generating pack',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [p1p1Handler],
  },
  {
    method: 'get',
    path: '/:id/:seed',
    handler: [p1p1SeedHandler],
  },
];
