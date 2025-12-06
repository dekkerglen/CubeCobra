import Cube from 'dynamo/models/cube';
import CubeHash from 'dynamo/models/cubeHash';
import Draft from 'dynamo/models/draft';

import { isCubeListed } from 'serverutils/cubefn';
import { getFeaturedCubes } from 'serverutils/featuredQueue';
import { render } from 'serverutils/render';
import { Request, Response } from '../../types/express';

const exploreHandler = async (req: Request, res: Response) => {
  const recents = (await Cube.getByVisibility(Cube.VISIBILITY.PUBLIC)).items.filter((cube: any) =>
    isCubeListed(cube, req.user),
  );

  const featured = await getFeaturedCubes();

  const popularHashes = await CubeHash.getSortedByFollowers(`featured:false`, false);
  const popular = (await Cube.batchGet(popularHashes.items.map((hash: any) => hash.cube))).filter(
    (cube: any) => cube.visibility !== 'pr',
  );

  const recentDecks = await Draft.queryByTypeAndDate(Draft.TYPES.DRAFT);
  const recentlyDrafted = (await Cube.batchGet(recentDecks.items.map((deck: any) => deck.cube))).filter(
    (cube: any) => cube.visibility !== 'pr',
  );

  return render(req, res, 'ExplorePage', {
    recents: recents.sort((a: any, b: any) => b.date - a.date).slice(0, 12),
    featured,
    drafted: recentlyDrafted.sort((a: any, b: any) => b.date - a.date).slice(0, 12),
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
