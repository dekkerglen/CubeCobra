import Changelog from 'dynamo/models/changelog';
import { csrfProtection } from 'src/router/middleware';

import { Request, Response } from '../../../types/express';

export const changelogHandler = async (req: Request, res: Response) => {
  const { changelogId, cubeId } = req.body;
  try {
    const changelog = await Changelog.getById(cubeId, changelogId);

    return res.status(200).send({
      success: 'true',
      changelog,
    });
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      error: (err as Error).message,
    });
  }
};

export const routes = [
  {
    path: '/changelog',
    method: 'post',
    handler: [csrfProtection, changelogHandler],
  },
];
