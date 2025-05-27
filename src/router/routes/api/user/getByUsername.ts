import User from '../../../../dynamo/models/user';
import { csrfProtection } from '../../../../routes/middleware';
import { Request, Response } from '../../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.getByUsername(id);

    if (!user) {
      res.status(404).send({ error: 'User not found' });
      return;
    }

    res.status(200).send({ user });
  } catch {
    res.status(500).send({ error: 'Error' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, handler],
  },
];
