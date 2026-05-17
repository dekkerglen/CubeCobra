import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import { sanitizeChangelog } from 'dynamo/dao/ChangelogDynamoDao';
import { collaboratorIndexDao, cubeDao, draftDao, feedDao } from 'dynamo/daos';
import { getDailyP1P1 } from 'serverutils/dailyP1P1';
import { getFeaturedCubes } from 'serverutils/featuredQueue';
import { getCubesSortValues, getPinnedCubesForOwner, handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../types/express';
import { csrfProtection, ensureAuth } from '../middleware';

// Feed items embed BlogPost.Changelog which is hydrated with full card
// details by ChangelogDynamoDao.hydrateChangelog. We strip those before
// shipping to the client — the React feed component rehydrates from
// utils/cardDetailsCache. Mutates in place; safe because feedDao items
// are not reused across requests.
const stripFeedItemDetails = (item: any): any => {
  if (item?.document?.Changelog) {
    sanitizeChangelog(item.document.Changelog);
  }
  return item;
};

// Helper function to filter feed items based on cube privacy
const filterFeedItemsByPrivacy = (feedItems: any[]): any[] => {
  return feedItems.filter((item) => {
    const blog = item.document;
    if (!blog) return false;

    // DEVLOG posts are always visible
    if (blog.cube === 'DEVBLOG') {
      return true;
    }

    // Only show feed items from public cubes
    // Private and unlisted cube blogs should not appear in follower feeds
    return blog.cubeVisibility === CUBE_VISIBILITY.PUBLIC;
  });
};

const dashboardHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return redirect(req, res, '/landing');
    }

    const featured = await getFeaturedCubes(8);

    // Get daily P1P1
    const dailyP1P1 = await getDailyP1P1(req.logger);

    // Fetch cubes the user is collaborating on
    const collaboratingCubeIds = await collaboratorIndexDao.getCubeIdsForUser(req.user.id);
    const collaboratingCubes = collaboratingCubeIds.length > 0 ? await cubeDao.batchGet(collaboratingCubeIds) : [];

    const { sort, ascending } = getCubesSortValues(req.user);
    const [userCubes, { pinnedCubes, pinnedIds }] = await Promise.all([
      cubeDao.queryByOwner(req.user.id, sort, ascending, undefined, 36),
      getPinnedCubesForOwner(req.user.id, req.user.id),
    ]);
    const cubes = [...pinnedCubes, ...userCubes.items.filter((cube) => !pinnedIds.has(cube.id))];

    return render(req, res, 'DashboardPage', {
      featured,
      dailyP1P1,
      collaboratingCubes,
      cubes,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/landing');
  }
};

const userCubeDraftsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return redirect(req, res, '/landing');
    }

    // Use unhydrated query to avoid loading cards/seats from S3 for better performance
    const decks = await draftDao.queryByCubeOwnerUnhydrated(req.user.id);

    return render(
      req,
      res,
      'UserCubeDraftsPage',
      {
        decks: decks.items,
        lastKey: decks.lastKey,
      },
      { title: 'Drafts of Your Cubes' },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/dashboard');
  }
};

const getMoreFeedItemsHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).send({ success: 'false', message: 'Unauthorized' });
  }

  const { lastKey } = req.body;
  const { user } = req;

  const result = await feedDao.getByTo(user.id, lastKey ?? undefined);

  // Filter out blog posts from private cubes that the user doesn't own
  const filteredItems = filterFeedItemsByPrivacy(result.items || []);

  return res.status(200).send({
    success: 'true',
    items: filteredItems.map((item: any) => stripFeedItemDetails(item).document),
    lastKey: result.lastKey,
  });
};

const getMoreDecksHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).send({ success: 'false', message: 'Unauthorized' });
  }

  const { lastKey } = req.body;

  // Use unhydrated query to avoid loading cards/seats from S3 for better performance
  const result = await draftDao.queryByCubeOwnerUnhydrated(req.user.id, lastKey ?? undefined);

  return res.status(200).send({
    success: 'true',
    items: result.items,
    lastKey: result.lastKey,
  });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [csrfProtection, ensureAuth, dashboardHandler],
  },
  {
    path: '/drafts',
    method: 'get',
    handler: [csrfProtection, ensureAuth, userCubeDraftsHandler],
  },
  {
    path: '/getmorefeeditems',
    method: 'post',
    handler: [csrfProtection, ensureAuth, getMoreFeedItemsHandler],
  },
  {
    path: '/getmoredecks',
    method: 'post',
    handler: [csrfProtection, ensureAuth, getMoreDecksHandler],
  },
];
