import { ContentStatus } from '@utils/datatypes/Content';
import { podcastDao } from 'dynamo/daos';
import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

const resourcesHandler = async (req: Request, res: Response) => {
  const podcasts = await podcastDao.queryByStatus(ContentStatus.PUBLISHED);

  return render(
    req,
    res,
    'ResourcesPage',
    {
      podcasts: podcasts.items || [],
    },
    { title: 'Resources' },
  );
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [resourcesHandler],
  },
];
