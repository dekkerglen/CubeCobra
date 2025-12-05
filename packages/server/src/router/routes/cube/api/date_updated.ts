import Cube from 'dynamo/models/cube';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const dateupdatedHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    const result = await Cube.getById(req.params.id);

    if (!result || !isCubeViewable(result, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'No such cube.',
      });
    }

    return res.status(200).send({
      success: 'true',
      date_updated: result.date,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving cube date',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [dateupdatedHandler],
  },
];
