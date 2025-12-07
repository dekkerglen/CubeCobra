import { GIT_COMMIT } from 'serverutils/git';
import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

const versionHandler = async (req: Request, res: Response) => {
  return render(req, res, 'VersionPage', {
    version: process.env.CUBECOBRA_VERSION,
    host: process.env.DOMAIN,
    gitCommit: GIT_COMMIT,
  });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [versionHandler],
  },
];
