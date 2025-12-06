import carddb from 'serverutils/carddb';
import { Request, Response } from '../../../../types/express';

export const fullnamesHandler = async (_req: Request, res: Response) => {
  return res.status(200).send({
    success: 'true',
    cardnames: carddb.full_names,
  });
};

export const routes = [
  {
    method: 'get',
    path: '',
    handler: [fullnamesHandler],
  },
];
