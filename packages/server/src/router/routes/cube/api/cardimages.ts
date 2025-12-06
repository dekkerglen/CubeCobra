import carddb from 'serverutils/carddb';
import { Request, Response } from '../../../../types/express';

export const cardimagesHandler = async (_req: Request, res: Response) => {
  return res.status(200).send({
    success: 'true',
    cardimages: carddb.cardimages,
  });
};

export const routes = [
  {
    method: 'get',
    path: '',
    handler: [cardimagesHandler],
  },
];
