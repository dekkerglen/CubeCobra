import { changelogDao } from 'dynamo/daos';

import { Request, Response } from '../../../types/express';

export const changelogHandler = async (req: Request, res: Response) => {
  const { changelogId, cubeId } = req.body;
  try {
    const changelog = await changelogDao.getChangelog(cubeId, changelogId);

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
    handler: [changelogHandler],
  },
];
