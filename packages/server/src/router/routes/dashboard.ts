import BlogPost from '@utils/datatypes/BlogPost';
import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import { DAILY_GAME_KEYS } from '@utils/datatypes/DailyGameStats';
import { sanitizeChangelog } from 'dynamo/dao/ChangelogDynamoDao';
import { blogDao, collaboratorIndexDao, cubeDao, draftDao, feedDao } from 'dynamo/daos';
import { pickDailyGame } from 'serverutils/dailyGamePick';
import { getFeaturedCubes } from 'serverutils/featuredQueue';
import { DEV_BLOG_CUBE, mergeFeedStreams, parseFeedCursor } from 'serverutils/feedMerge';
import { getCubesSortValues, getPinnedCubesForOwner, handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../types/express';
import { csrfProtection, ensureAuth } from '../middleware';

const FEED_PAGE_SIZE = 50;
const MAX_FEED_FETCH_ROUNDS = 5;

// Blog posts embed a Changelog hydrated with full card details by
// ChangelogDynamoDao.hydrateChangelog. We strip those before shipping to the
// client — the React feed component rehydrates from utils/cardDetailsCache.
// Mutates in place; safe because these items are not reused across requests.
const stripBlogDetails = (blog: BlogPost): BlogPost => {
  if (blog?.Changelog) {
    sanitizeChangelog(blog.Changelog as any);
  }
  return blog;
};

// Only public cubes' blog posts belong in a feed; private and unlisted ones must not leak.
// Dev blog announcements belong to no cube and are exempt.
const isPubliclyVisible = (blog: BlogPost): boolean => {
  if (!blog) return false;
  if (blog.cube === DEV_BLOG_CUBE) return true;
  return blog.cubeVisibility === CUBE_VISIBILITY.PUBLIC;
};

const dashboardHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return redirect(req, res, '/landing');
    }

    const { sort, ascending } = getCubesSortValues(req.user);
    const hiddenDailyGames = req.user.hiddenDailyGames ?? [];

    // The dashboard is a hot page, so everything that does not depend on something
    // else goes out together. The only serial step left is the collaborating-cube
    // batchGet, which needs the ids this wave resolves.
    const [featured, dailyGame, collaboratingCubeIds, userCubes, { pinnedCubes, pinnedIds }] = await Promise.all([
      getFeaturedCubes(8),
      // One of the dailies this user has left on, chosen from the ones they haven't started today.
      pickDailyGame({
        logger: req.logger,
        userId: req.user.id,
        games: DAILY_GAME_KEYS.filter((game) => !hiddenDailyGames.includes(game)),
      }),
      collaboratorIndexDao.getCubeIdsForUser(req.user.id),
      cubeDao.queryByOwner(req.user.id, sort, ascending, undefined, 36),
      getPinnedCubesForOwner(req.user.id, req.user.id),
    ]);

    const collaboratingCubes = collaboratingCubeIds.length > 0 ? await cubeDao.batchGet(collaboratingCubeIds) : [];
    const cubes = [...pinnedCubes, ...userCubes.items.filter((cube) => !pinnedIds.has(cube.id))];

    return render(
      req,
      res,
      'DashboardPage',
      {
        featured,
        dailyGame,
        collaboratingCubes,
        cubes,
      },
      { title: 'Dashboard' },
    );
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

  const { user } = req;

  let cursor = parseFeedCursor(req.body.lastKey);
  let items: BlogPost[] = [];

  // A page can come back empty while records remain — every item in it may be a legacy
  // DEVBLOG row or a post whose cube has since gone private. The client renders its
  // "no feed items" state on an empty page and offers no way to advance, so keep fetching
  // rather than stranding the viewer. Bounded so a long run of hidden records cannot hold
  // the request open.
  for (let round = 0; round < MAX_FEED_FETCH_ROUNDS; round += 1) {
    // Two date-descending streams: what this user follows, and the site-wide announcements
    // every user gets. Both are bounded by the cursor's date rather than resumed from a
    // DynamoDB start key, because a merged page consumes a partial page from each.
    const [personalResult, announcementResult] = await Promise.all([
      feedDao.getByTo(user.id, undefined, FEED_PAGE_SIZE, cursor?.date),
      blogDao.queryByCube(DEV_BLOG_CUBE, undefined, FEED_PAGE_SIZE, cursor?.date),
    ]);

    const merged = mergeFeedStreams({
      personal: (personalResult.items || []).map((item: any) => item.document).filter(Boolean),
      personalHasMore: !!personalResult.lastKey,
      announcements: announcementResult.items || [],
      announcementsHasMore: !!announcementResult.lastKey,
      limit: FEED_PAGE_SIZE,
      cursor,
      isVisible: isPubliclyVisible,
    });

    items = merged.items;
    cursor = merged.cursor;

    if (items.length > 0 || !cursor) {
      break;
    }
  }

  return res.status(200).send({
    success: 'true',
    items: items.map(stripBlogDetails),
    lastKey: cursor ?? null,
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
