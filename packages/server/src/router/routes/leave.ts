import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

const leaveHandler = (req: Request, res: Response) => {
  return render(req, res, 'LeaveWarningPage', {
    url: req.query.url,
  });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [leaveHandler],
  },
];
