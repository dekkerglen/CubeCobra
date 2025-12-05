import Cube from 'dynamo/models/cube';
import { FeaturedQueue } from 'dynamo/models/featuredQueue';

import { render } from '../../serverutils/render';
import { Request, Response } from '../../types/express';

const queueHandler = async (req: Request, res: Response) => {
  let featured: any[] = [];
  let lastkey: any = null;

  do {
    const response = await FeaturedQueue.querySortedByDate(lastkey || undefined);
    featured = featured.concat(response.items);
    lastkey = response.lastKey;
  } while (lastkey);

  const cubes = await Cube.batchGet(featured.map((f: any) => f.cube));
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
