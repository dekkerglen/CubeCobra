import { render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const getExportsGuideHandler = async (req: Request, res: Response) => {
  return render(req, res, 'ExportsGuidePage', {}, { title: 'Data Exports Guide' });
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getExportsGuideHandler],
  },
];
