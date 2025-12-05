import carddb from '../../../../serverutils/carddb';
import { Request, Response } from '../../../../types/express';

export const imagedictHandler = async (_req: Request, res: Response) => {
  return res.status(200).send({
    success: 'true',
    dict: carddb.imagedict,
  });
};

export const routes = [
  {
    method: 'get',
    path: '',
    handler: [imagedictHandler],
  },
];
