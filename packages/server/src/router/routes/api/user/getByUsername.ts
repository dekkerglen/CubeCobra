import { userDao } from 'dynamo/daos';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      req.flash('danger', 'Invalid user ID');
      return redirect(req, res, '/404');
    }

    const user = await userDao.getByUsername(id);

    if (!user) {
      res.status(404).send({ error: 'User not found' });
      return;
    }

    // Public lookup: return only what callers need to link a player to an account, never
    // the stored user (which carries account details).
    res.status(200).send({ user: { id: user.id, username: user.username } });
  } catch {
    res.status(500).send({ error: 'Error' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [handler],
  },
];
