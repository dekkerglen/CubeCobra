import { UserRoles } from '@utils/datatypes/User';
import Cube from 'dynamo/models/cube';
import FeaturedQueue from 'dynamo/models/featuredQueue';
import { csrfProtection, ensureRole } from 'routes/middleware';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const featuredcubesHandler = async (req: Request, res: Response) => {
  let featured: any[] = [];
  let lastkey: Record<string, any> | null | undefined = null;

  do {
    const response = await FeaturedQueue.querySortedByDate(lastkey || undefined);
    featured = featured.concat(response.items);
    lastkey = response.lastKey;
  } while (lastkey);

  const cubes = await Cube.batchGet(featured.map((f: any) => f.cube));
  const sortedCubes = featured
    .map((f: any) => cubes.find((c: any) => c.id === f.cube))
    .filter((c): c is NonNullable<typeof c> => c !== undefined && c !== null);

  return render(req, res, 'FeaturedCubesQueuePage', {
    cubes: sortedCubes,
    lastRotation: featured.length > 0 ? featured[0].featuredOn : new Date(0).valueOf(),
  });
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), featuredcubesHandler],
  },
];
