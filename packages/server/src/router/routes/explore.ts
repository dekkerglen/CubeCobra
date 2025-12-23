import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { cubeDao, draftDao } from 'dynamo/daos';
import { isCubeListed } from 'serverutils/cubefn';
import { getFeaturedCubes } from 'serverutils/featuredQueue';
import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

const exploreHandler = async (req: Request, res: Response) => {
  const recents = (await cubeDao.queryAllCubes('date', false, undefined, 24)).items.filter((cube: any) =>
    isCubeListed(cube, req.user),
  );

  const featured = await getFeaturedCubes();

  const popular = (await cubeDao.queryAllCubes('popularity', false, undefined, 24)).items.filter((cube: any) =>
    isCubeListed(cube, req.user),
  );

  const recentDecks = await draftDao.queryByTypeAndDate(DRAFT_TYPES.DRAFT);
  const uniqueDecks = new Map<string, any>();
  for (const deck of recentDecks.items) {
    if (!uniqueDecks.has(deck.cube)) {
      uniqueDecks.set(deck.cube, deck);
    }
  }
  const recentlyDrafted = (await cubeDao.batchGet(Array.from(uniqueDecks.keys()))).filter(
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
