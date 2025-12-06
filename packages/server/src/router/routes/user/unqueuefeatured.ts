import * as fq from 'serverutils/featuredQueue';
import { redirect } from 'serverutils/render';
import { csrfProtection, ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.user) {
    req.flash('danger', 'User not authenticated');
    return redirect(req, res, '/user/account?nav=patreon&tab=4');
  }

  try {
    await fq.removeCubeFromQueue(req.user.id);

    req.flash('success', 'Successfully removed cube from queue');
  } catch (err) {
    req.flash('danger', (err as Error).message);
  }
  return redirect(req, res, '/user/account?nav=patreon&tab=4');
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
