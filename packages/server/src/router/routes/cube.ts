import { NoticeType } from '@utils/datatypes/Notice';
import { changelogDao, cubeDao, draftDao, featuredQueueDao } from 'dynamo/daos';
import Notice from 'dynamo/models/notice';
import p1p1PackModel from 'dynamo/models/p1p1Pack';
import User from 'dynamo/models/user';
import { csrfProtection, ensureAuth } from 'router/middleware';
import {
  abbreviate,
  cachePromise,
  generateBalancedPack,
  generatePack,
  isCubeListed,
  isCubeViewable,
} from 'serverutils/cubefn';
import { isInFeaturedQueue } from 'serverutils/featuredQueue';
import { generatePackImage } from 'serverutils/imageUtils';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { addNotification, getBaseUrl, isAdmin } from 'serverutils/util';

import { Request, Response } from '../../types/express';
import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;

export const reportHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }
    const report = {
      subject: cube.owner.id,
      body: `"${cube.name}" was reported by ${req.user!.username}`,
      user: req.user ? req.user.id : null,
      date: Date.now().valueOf(),
      type: NoticeType.CUBE_REPORT,
    };

    await Notice.put(report);

    req.flash(
      'success',
      'Thank you for the report! Our moderators will review the report can decide whether to take action.',
    );

    return redirect(req, res, `/cube/overview/${req.params.id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/overview/${req.params.id}`);
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
      return redirect(req, res, '/cube/overview/404');
    }
    if (!cube || cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/overview/${encodeURIComponent(cubeId)}`);
    }

    await cubeDao.deleteById(cubeId);

    req.flash('success', 'Cube Removed');
    return redirect(req, res, '/dashboard');
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const viewHandler = (req: Request, res: Response) => {
  return redirect(req, res, `/cube/overview/${req.params.id}`);
};

export const defaultDraftFormatHandler = async (req: Request, res: Response) => {
  const cubeid = req.params.id!;
  const formatId = parseInt(req.params.formatId!, 10);

  const cube = await cubeDao.getById(cubeid);
  if (
    !isCubeViewable(cube, req.user) ||
    !cube ||
    cube.owner.id !== req.user!.id ||
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

    const cards = await cubeDao.getCards(cube.id);

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
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/overview/${req.params.id}`);
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
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/overview/${req.params.id}`);
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
    const query = await draftDao.queryByCube(req.params.id!, lastKey);

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

export const recentsHandler = async (req: Request, res: Response) => {
  const result = await cubeDao.queryByVisibility(CUBE_VISIBILITY.PUBLIC, 'date', false);

  return render(req, res, 'RecentlyUpdateCubesPage', {
    items: result.items.filter((cube: any) => isCubeListed(cube, req.user)),
    lastKey: result.lastKey,
  });
};

export const getMoreRecentsHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;

  const result = await cubeDao.queryByVisibility(CUBE_VISIBILITY.PUBLIC, 'date', false, lastKey);

  return res.status(200).send({
    success: 'true',
    items: result.items.filter((cube: any) => isCubeListed(cube, req.user)),
    lastKey: result.lastKey,
  });
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

  cube.following = [...new Set([...(cube.following || []), user!.id])];

  if (!user!.followedCubes) {
    user!.followedCubes = [];
  }

  if (!user!.followedCubes.some((id: string) => id === cube.id)) {
    user!.followedCubes.push(cube.id);
  }

  //TODO: Can remove after fixing models to not muck with the original input
  const cubeOwner = cube.owner;
  await User.update(user!);
  await cubeDao.update(cube);

  await addNotification(
    cubeOwner,
    user!,
    `/cube/overview/${cube.id}`,
    `${user!.username} followed your cube: ${cube.name}`,
  );

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

  const { user } = req;
  cube.following = cube.following?.filter((id: string) => req.user!.id !== id) || [];
  user!.followedCubes = user!.followedCubes?.filter((id: string) => cube.id !== id) || [];

  await User.update(user!);
  await cubeDao.update(cube);

  return res.status(200).send({
    success: 'true',
  });
};

export const featureHandler = async (req: Request, res: Response) => {
  const redirectUrl = `/cube/overview/${encodeURIComponent(req.params.id!)}`;
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
  const redirectUrl = `/cube/overview/${encodeURIComponent(req.params.id!)}`;
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

    const cards = await cubeDao.getCards(cube.id);
    const isBalanced = req.query.balanced === 'true';

    const cacheKey = `/samplepack/${req.params.id}/${req.params.seed}${isBalanced ? '?balanced=true' : ''}`;
    const imageBuffer = await cachePromise(cacheKey, async () => {
      if (isBalanced) {
        const result = await generateBalancedPack(cube, cards, req.params.seed!, 10, null);
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
    const pack = await p1p1PackModel.getById(packId!);
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

    const pack = await p1p1PackModel.getById(packId);
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
    handler: [historyHandler],
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
    path: '/recents',
    method: 'get',
    handler: [csrfProtection, recentsHandler],
  },
  {
    path: '/getmorerecents',
    method: 'post',
    handler: [csrfProtection, ensureAuth, getMoreRecentsHandler],
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
