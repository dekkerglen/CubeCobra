import { safeHttpUrl } from '@utils/safeUrl';
import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

export const leaveHandler = (req: Request, res: Response) => {
  // Only absolute http(s) links get the "continue" page; anything else (javascript:, data:,
  // relative paths) would run script or redirect somewhere unexpected when followed.
  const url = safeHttpUrl(req.query.url);
  if (!url) {
    res.status(400);
    return render(req, res, 'ErrorPage', {
      title: 'Invalid link',
      error: 'This link is not a valid web address.',
    });
  }

  return render(req, res, 'LeaveWarningPage', { url });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [leaveHandler],
  },
];
