import { isCubeListed } from 'serverutils/cubefn';
import { getFeaturedCubes } from 'serverutils/featuredQueue';
import { render } from 'serverutils/render';
import { cubeDao, draftDao } from 'dynamo/daos';

import { Request, Response } from '../../types/express';
import { DRAFT_TYPES } from '@utils/datatypes/Draft';

const exploreHandler = async (req: Request, res: Response) => {
  const recents = (await cubeDao.queryAllCubes('date', false)).items.filter((cube: any) =>
    isCubeListed(cube, req.user),
  );

  const featured = await getFeaturedCubes();

  const popular = (await cubeDao.queryAllCubes('popularity', false)).items.filter((cube: any) =>
    isCubeListed(cube, req.user),
  );

  const recentDecks = await draftDao.queryByTypeAndDate(DRAFT_TYPES.DRAFT);
  const recentlyDrafted = (await cubeDao.batchGet(recentDecks.items.map((deck: any) => deck.cube))).filter(
    (cube: any) => cube.visibility !== 'pr',
  );

  return render(req, res, 'ExplorePage', {
    recents: recents.sort((a: any, b: any) => b.dateLastUpdated - a.dateLastUpdated).slice(0, 12),
    featured,
    drafted: recentlyDrafted.sort((a: any, b: any) => b.dateLastUpdated - a.dateLastUpdated).slice(0, 12),
    popular: popular.sort((a: any, b: any) => b.following.length - a.following.length).slice(0, 12),
  });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [exploreHandler],
  },
];
