import { featuredQueueDao } from 'dynamo/daos';
import { cubeDao } from 'dynamo/daos';
import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

const queueHandler = async (req: Request, res: Response) => {
  let featured: any[] = [];
  let lastkey: any = null;

  do {
    const response = await featuredQueueDao.querySortedByDate(lastkey || undefined);
    featured = featured.concat(response.items);
    lastkey = response.lastKey;
  } while (lastkey);

  const cubes = await cubeDao.batchGet(featured.map((f: any) => f.cube));
  const sortedCubes = featured.map((f: any) => cubes.find((c: any) => c.id === f.cube)).filter((c: any) => c);

  return render(req, res, 'FeaturedQueuePage', {
    cubes: sortedCubes,
  });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [queueHandler],
  },
];
