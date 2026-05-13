import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import { NoticeStatus, NoticeType } from '@utils/datatypes/Notice';
import {
  changelogDao,
  collaboratorIndexDao,
  cubeDao,
  draftDao,
  featuredQueueDao,
  noticeDao,
  p1p1PackDao,
  userDao,
} from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import {
  abbreviate,
  cachePromise,
  generateBalancedPack,
  generatePack,
  isCubeEditable,
  isCubeViewable,
} from 'serverutils/cubefn';
import { isInFeaturedQueue } from 'serverutils/featuredQueue';
import { generatePackImage } from 'serverutils/imageUtils';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { addNotification, getBaseUrl, isAdmin } from 'serverutils/util';

import { Request, Response } from '../../types/express';

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;

export const reportHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    // Prevent duplicate active reports for this cube by this user
    const existing = await noticeDao.getByStatus(NoticeStatus.ACTIVE);
    const alreadyReported = (existing.items || []).some(
      (n) =>
        n.type === NoticeType.CUBE_REPORT &&
        n.subject === cube.owner.id &&
        String(n.user?.id || n.user) === String(req.user?.id || null),
    );
    if (alreadyReported) {
      req.flash(
        'success',
        'Thank you for the report! Our moderators will review the report can decide whether to take action.',
      );
      return redirect(req, res, `/cube/list/${req.params.id}`);
    }

    const report = {
      subject: cube.owner.id,
      body: `"${cube.name}" was reported by ${req.user!.username}`,
      user: req.user ? req.user.id : null,
      date: Date.now().valueOf(),
      type: NoticeType.CUBE_REPORT,
    };

    await noticeDao.put(report);

    req.flash(
      'success',
      'Thank you for the report! Our moderators will review the report can decide whether to take action.',
    );

    return redirect(req, res, `/cube/list/${req.params.id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/list/${req.params.id}`);
  }
};

export const removeHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.id;
    if (!cubeId) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(cubeId);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/list/404');
    }
    if (!cube || (cube.owner.id !== req.user!.id && !isAdmin(req.user!))) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/list/${encodeURIComponent(cubeId)}`);
    }

    await cubeDao.deleteById(cubeId);
    await collaboratorIndexDao.removeAllForCube(cubeId, cube.collaborators ?? []);

    req.flash('success', 'Cube Removed');
    return redirect(req, res, '/dashboard');
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const viewHandler = (req: Request, res: Response) => {
  return redirect(req, res, `/cube/list/${req.params.id}`);
};

export const historyRedirectHandler = (req: Request, res: Response) => {
  return redirect(req, res, `/cube/about/${req.params.id}?view=changelog`);
};

export const defaultDraftFormatHandler = async (req: Request, res: Response) => {
  const cubeid = req.params.id!;
  const formatId = parseInt(req.params.formatId!, 10);

  const cube = await cubeDao.getById(cubeid);
  if (
    !isCubeViewable(cube, req.user) ||
    !cube ||
    !isCubeEditable(cube, req.user) ||
    !Number.isInteger(formatId) ||
    formatId >= cube.formats.length ||
    formatId < -1
  ) {
    req.flash('danger', 'Invalid request.');
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid)}`);
  }
  cube.defaultFormat = formatId;

  await cubeDao.update(cube);
  req.flash('success', 'Default draft format updated.');
  return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid)}`);
};

export const listHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id, cube);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeListPage',
      {
        cube,
        cards,
      },
      {
        title: `${abbreviate(cube.name)} - List`,
        metadata: generateMeta(
          `Cube Cobra List: ${cube.name}`,
          cube.brief,
          cube.image.uri,
          `${baseUrl}/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/about/${req.params.id}?view=primer`);
  }
};

export const historyHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const query = await changelogDao.queryByCubeWithData(cube.id, undefined, 36);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeHistoryPage',
      {
        cube,
        changes: query.items,
        lastKey: query.lastKey,
      },
      {
        title: `${abbreviate(cube.name)} - List`,
        metadata: generateMeta(
          `Cube Cobra List: ${cube.name}`,
          cube.brief,
          cube.image.uri,
          `${baseUrl}/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/about/${req.params.id}?view=primer`);
  }
};

export const getMoreChangelogsHandler = async (req: Request, res: Response) => {
  const { lastKey, cubeId } = req.body;
  const query = await changelogDao.queryByCubeWithData(cubeId, lastKey, 18);

  return res.status(200).send({
    success: 'true',
    posts: query.items,
    lastKey: (query as any).lastKey || null,
  });
};

export const getMoreDecksHandler = async (req: Request, res: Response) => {
  try {
    const { lastKey } = req.body;
    // Use unhydrated query to avoid loading cards/seats from S3 for better performance
    const query = await draftDao.queryByCubeUnhydrated(req.params.id!, lastKey);

    return res.status(200).send({
      success: 'true',
      decks: query.items,
      lastKey: (query as any).lastKey || null,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      success: 'false',
    });
  }
};

export const followHandler = async (req: Request, res: Response) => {
  const { user } = req;
  const cube = await cubeDao.getById(req.params.id!);

  if (!isCubeViewable(cube, user) || !cube) {
    req.flash('danger', 'Cube not found');
    return res.status(404).send({
      success: 'false',
    });
  }

  const alreadyLiked = await cubeDao.getLike(cube.id, user!.id);
  if (!alreadyLiked) {
    await cubeDao.writeLike(cube.id, user!.id);
    const newLikeCount = await cubeDao.incrementLikeCount(cube.id, 1);
    await userDao.incrementLikedCubesCount(user!.id, 1);

    // Hash-row GSI sort keys embed cube.likeCount; refresh them so popularity ranking
    // reflects the new count. cubeDao.update() recomputes hash rows on metadata change.
    cube.likeCount = newLikeCount;
    await cubeDao.update(cube, { skipTimestampUpdate: true });

    const cubeOwner = cube.owner;
    if (!cubeOwner.disableFollowAlerts && !cube.disableFollowAlerts) {
      await addNotification(
        cubeOwner,
        user!,
        `/cube/list/${cube.id}`,
        `${user!.username} followed your cube: ${cube.name}`,
      );
    }
  }

  return res.status(200).send({
    success: 'true',
  });
};

export const unfollowHandler = async (req: Request, res: Response) => {
  const cube = await cubeDao.getById(req.params.id!);

  if (!isCubeViewable(cube, req.user) || !cube) {
    req.flash('danger', 'Cube not found');
    return res.status(404).send({
      success: 'false',
    });
  }

  const stillLiked = await cubeDao.getLike(cube.id, req.user!.id);
  if (stillLiked) {
    await cubeDao.deleteLike(cube.id, req.user!.id);
    const newLikeCount = await cubeDao.incrementLikeCount(cube.id, -1);
    await userDao.incrementLikedCubesCount(req.user!.id, -1);

    cube.likeCount = newLikeCount;
    await cubeDao.update(cube, { skipTimestampUpdate: true });
  }

  return res.status(200).send({
    success: 'true',
  });
};

export const isFollowedHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.params.id) {
      return res.status(200).send({ followed: false });
    }
    const followed = await cubeDao.getLike(req.params.id, req.user.id);
    return res.status(200).send({ followed });
  } catch (_err) {
    return res.status(200).send({ followed: false });
  }
};

export const featureHandler = async (req: Request, res: Response) => {
  const redirectUrl = `/cube/list/${encodeURIComponent(req.params.id!)}`;
  try {
    const { user } = req;
    if (!user || !isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, redirectUrl);
    }

    const cube = await cubeDao.getById(req.params.id!);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, redirectUrl);
    }
    if (cube.visibility !== CUBE_VISIBILITY.PUBLIC) {
      req.flash('danger', 'Cannot feature a private cube');
      return redirect(req, res, redirectUrl);
    }

    const existingQueueItem = await isInFeaturedQueue(cube);
    if (existingQueueItem) {
      req.flash('danger', 'Cube is already in the featured queue');
      return redirect(req, res, redirectUrl);
    }

    await featuredQueueDao.createFeaturedQueueItem({
      cube: cube.id,
      date: Date.now().valueOf(),
      owner: typeof cube.owner === 'object' ? cube.owner.id : cube.owner,
      featuredOn: null,
    });

    req.flash('success', 'Cube added to featured queue successfully.');
    return redirect(req, res, redirectUrl);
  } catch (err) {
    return handleRouteError(req, res, err as Error, redirectUrl);
  }
};

export const unfeatureHandler = async (req: Request, res: Response) => {
  const redirectUrl = `/cube/list/${encodeURIComponent(req.params.id!)}`;
  try {
    const { user } = req;
    if (!user || !isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, redirectUrl);
    }

    const cube = await cubeDao.getById(req.params.id!);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, redirectUrl);
    }

    const existingQueueItem = await isInFeaturedQueue(cube);
    if (!existingQueueItem) {
      req.flash('danger', 'Cube is not in the featured queue');
      return redirect(req, res, redirectUrl);
    }

    await featuredQueueDao.delete(existingQueueItem);

    req.flash('success', 'Cube removed from featured queue successfully.');
    return redirect(req, res, redirectUrl);
  } catch (err) {
    return handleRouteError(req, res, err as Error, redirectUrl);
  }
};

export const samplePackImageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.seed || !req.params.id) {
      req.flash('danger', 'Invalid parameters');
      return redirect(req, res, '/404');
    }

    req.params.seed = req.params.seed.replace('.png', '');
    const cube = await cubeDao.getById(req.params.id);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/playtest/404');
    }

    const cards = await cubeDao.getCards(cube.id, cube);
    const isBalanced = req.query.balanced === 'true';

    const cacheKey = `/samplepack/${req.params.id}/${req.params.seed}${isBalanced ? '?balanced=true' : ''}`;
    const imageBuffer = await cachePromise(cacheKey, async () => {
      if (isBalanced) {
        const result = await generateBalancedPack(cube, cards, req.params.seed!, 10, parseInt(req.params.seed!, 10));
        return generatePackImage(result.packResult.pack);
      } else {
        const pack = await generatePack(cube, cards, req.params.seed);
        return generatePackImage(pack.pack);
      }
    });

    res.writeHead(200, {
      'Content-Type': 'image/webp',
    });
    return res.end(imageBuffer);
  } catch (err) {
    req.flash('danger', (err as Error).message);
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
  }
};

export const p1p1Handler = async (req: Request, res: Response) => {
  try {
    const { packId } = req.params;

    // Validate pack exists
    const pack = await p1p1PackDao.getById(packId!);
    if (!pack) {
      req.flash('danger', 'P1P1 pack not found');
      return redirect(req, res, '/404');
    }

    // Get cube data
    const cube = await cubeDao.getById(pack.cubeId);
    if (!cube) {
      req.flash('danger', 'Associated cube not found');
      return redirect(req, res, '/404');
    }

    // Calculate pack image dimensions
    const width = Math.floor(Math.sqrt((5 / 3) * pack.cards.length));
    const height = Math.ceil(pack.cards.length / width);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'P1P1Page',
      {
        packId,
        cube,
      },
      {
        title: 'Pack 1 Pick 1',
        metadata: generateMeta(
          'Pack 1 Pick 1 - Cube Cobra',
          'Vote on your first pick from this pack!',
          `${baseUrl}/cube/p1p1packimage/${packId}.png`,
          `${baseUrl}/cube/p1p1/${packId}`,
          CARD_WIDTH * width,
          CARD_HEIGHT * height,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const p1p1PackImageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.packId) {
      req.flash('danger', 'Invalid pack ID');
      return redirect(req, res, '/404');
    }

    req.params.packId = req.params.packId.replace('.png', '');
    const { packId } = req.params;

    const pack = await p1p1PackDao.getById(packId);
    if (!pack || !pack.cards || pack.cards.length === 0) {
      req.flash('danger', 'P1P1 pack not found');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(pack.cubeId);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const imageBuffer = await cachePromise(`/p1p1pack/${packId}`, async () => {
      return generatePackImage(pack.cards);
    });

    res.writeHead(200, {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=86400, immutable',
      ETag: `"${packId}"`,
    });
    return res.end(imageBuffer);
  } catch (err) {
    req.flash('danger', (err as Error).message || 'Error generating pack image');
    return redirect(req, res, '/404');
  }
};

export const routes = [
  {
    path: '/report/:id',
    method: 'get',
    handler: [csrfProtection, ensureAuth, reportHandler],
  },
  {
    path: '/remove/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, removeHandler],
  },
  {
    path: '/view/:id',
    method: 'get',
    handler: [csrfProtection, viewHandler],
  },
  {
    path: '/:id/defaultdraftformat/:formatId',
    method: 'get',
    handler: [csrfProtection, ensureAuth, defaultDraftFormatHandler],
  },
  {
    path: '/list/:id',
    method: 'get',
    handler: [listHandler],
  },
  {
    path: '/history/:id',
    method: 'get',
    handler: [historyRedirectHandler],
  },
  {
    path: '/getmorechangelogs',
    method: 'post',
    handler: [getMoreChangelogsHandler],
  },
  {
    path: '/getmoredecks/:id',
    method: 'post',
    handler: [getMoreDecksHandler],
  },
  {
    path: '/follow/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, followHandler],
  },
  {
    path: '/unfollow/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, unfollowHandler],
  },
  {
    path: '/isfollowed/:id',
    method: 'get',
    handler: [csrfProtection, isFollowedHandler],
  },
  {
    path: '/feature/:id',
    method: 'get',
    handler: [csrfProtection, ensureAuth, featureHandler],
  },
  {
    path: '/unfeature/:id',
    method: 'get',
    handler: [csrfProtection, ensureAuth, unfeatureHandler],
  },
  {
    path: '/samplepackimage/:id/:seed',
    method: 'get',
    handler: [samplePackImageHandler],
  },
  {
    path: '/p1p1/:packId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',
    method: 'get',
    handler: [p1p1Handler],
  },
  {
    path: '/p1p1packimage/:packId',
    method: 'get',
    handler: [p1p1PackImageHandler],
  },
];
