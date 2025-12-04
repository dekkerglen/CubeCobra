import { cardFromId } from '../../../../serverutils/carddb';
import { Request, Response } from '../../../../types/express';

export const getcardfromidHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Card ID is required',
      });
    }

    const card = cardFromId(req.params.id);
    return res.status(200).send({
      success: 'true',
      card,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving card',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [getcardfromidHandler],
  },
];
