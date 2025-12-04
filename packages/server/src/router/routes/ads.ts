import { redirect } from '../../serverutils/render';
import { Request, Response } from '../../types/express';

// Ads.txt redirect to external URL
const adsTxtHandler = (req: Request, res: Response) => {
  redirect(req, res, 'https://api.nitropay.com/v1/ads-860.txt');
};

export const routes = [
  {
    path: '.txt',
    method: 'get',
    handler: [adsTxtHandler],
  },
];
