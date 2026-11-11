import { UserRoles } from '@utils/datatypes/User';
import { cubeDao, featuredQueueDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirectToAdminTab } from 'serverutils/adminDashboard';
import { Request, Response } from 'types/express';

export const featuredcubesDataHandler = async (req: Request, res: Response) => {
  try {
    let featured: any[] = [];
    let lastkey: Record<string, any> | null | undefined = null;

    do {
      const response: { items?: any[]; lastKey?: Record<string, any> } = await featuredQueueDao.querySortedByDate(
        lastkey || undefined,
      );
      featured = featured.concat(response.items || []);
      lastkey = response.lastKey;
    } while (lastkey);

    const cubes = await cubeDao.batchGet(featured.map((f: any) => f.cube));
    const sortedCubes = featured
      .map((f: any) => cubes.find((c: any) => c.id === f.cube))
      .filter((c): c is NonNullable<typeof c> => c !== undefined && c !== null);

    return res.status(200).json({
      success: true,
      cubes: sortedCubes,
      lastRotation: featured.length > 0 ? featured[0].featuredOn : new Date(0).valueOf(),
    });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), redirectToAdminTab('featuredcubes')],
  },
  {
    method: 'get',
    path: '/data',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), featuredcubesDataHandler],
  },
];
