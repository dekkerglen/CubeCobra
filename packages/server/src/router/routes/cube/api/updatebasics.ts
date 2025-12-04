import Cube from 'dynamo/models/cube';
import { Request, Response } from '../../../../types/express';

export const updatebasicsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    if (!req.user || cube.owner.id !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Cube can only be updated by cube owner.',
      });
    }

    cube.basics = req.body;

    await Cube.update(cube);

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error updating basics',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [updatebasicsHandler],
  },
];
