import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { cubeDao, draftDao } from 'dynamo/daos';
import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

const LIMIT = 100;

const getRecentDraftedCubes = async (lastKey?: string) => {
  // Query recent drafts
  const recentDecks = await draftDao.queryByTypeAndDate(
    DRAFT_TYPES.DRAFT,
    lastKey ? JSON.parse(lastKey) : undefined,
    LIMIT,
  );

  // Get unique cube IDs (we want each cube to appear only once)
  const uniqueCubeIds = new Set<string>();
  const cubeIdToDate = new Map<string, number>();

  for (const deck of recentDecks.items) {
    if (!uniqueCubeIds.has(deck.cube)) {
      uniqueCubeIds.add(deck.cube);
      cubeIdToDate.set(deck.cube, deck.date);
    }
  }

  // Fetch the actual cubes
  const cubes = await cubeDao.batchGet(Array.from(uniqueCubeIds));

  // Filter out private cubes and sort by draft date
  const visibleCubes = cubes
    .filter((cube: any) => cube.visibility !== 'pr')
    .sort((a: any, b: any) => {
      const dateA = cubeIdToDate.get(a.id) || 0;
      const dateB = cubeIdToDate.get(b.id) || 0;
      return dateB - dateA;
    });

  return {
    cubes: visibleCubes,
    lastKey: recentDecks.lastKey ? JSON.stringify(recentDecks.lastKey) : undefined,
  };
};

const recentdraftsHandler = async (req: Request, res: Response) => {
  const result = await getRecentDraftedCubes();

  return render(req, res, 'RecentDraftsPage', {
    cubes: result.cubes,
    lastKey: result.lastKey,
  });
};

const getmoreHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;

  const result = await getRecentDraftedCubes(lastKey);

  return res.status(200).send({
    success: 'true',
    cubes: result.cubes,
    lastKey: result.lastKey,
  });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [recentdraftsHandler],
  },
  {
    path: '/getmore',
    method: 'post',
    handler: [getmoreHandler],
  },
];
