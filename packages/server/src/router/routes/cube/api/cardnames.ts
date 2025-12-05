import carddb from '../../../../serverutils/carddb';
import { Request, Response } from '../../../../types/express';

export const cardnamesHandler = async (_req: Request, res: Response) => {
  return res.status(200).send({
    success: 'true',
    cardnames: carddb.cardtree,
  });
};

export const routes = [
  {
    method: 'get',
    path: '',
    handler: [cardnamesHandler],
  },
];
