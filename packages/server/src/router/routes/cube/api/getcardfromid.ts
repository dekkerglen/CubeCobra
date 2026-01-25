import { cardFromId } from 'serverutils/carddb';

import { Request, Response } from '../../../../types/express';

// Cached error responses to reduce object allocation
const ERROR_MISSING_ID = {
  success: 'false',
  message: 'Card ID is required',
};

const ERROR_RETRIEVAL = {
  success: 'false',
  message: 'Error retrieving card',
};

export const getcardfromidHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send(ERROR_MISSING_ID);
    }

    const card = cardFromId(req.params.id);
    return res.status(200).send({
      success: 'true',
      card,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send(ERROR_RETRIEVAL);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [getcardfromidHandler],
  },
];
