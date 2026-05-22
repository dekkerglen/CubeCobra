import Card from '@utils/datatypes/Card';
import { sanitizeChangelog } from 'dynamo/dao/ChangelogDynamoDao';
import { changelogDao, cubeDao } from 'dynamo/daos';
import { cardFromId } from 'serverutils/carddb';
import { CSV_HEADER, writeCard } from 'serverutils/cube';
import { abbreviate, compareCubes, isCubeViewable, reconstructCubeAtChangelog } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const changelogHandler = async (req: Request, res: Response) => {
  // Redirect to the new consolidated about page with changelog view
  return redirect(req, res, `/cube/about/${req.params.id}?view=changelog`);
};

export const changelogDetailHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.cubeId!;
    const changelogId = req.params.changelogId!;

    const cube = await cubeDao.getById(cubeId);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const changelog = await changelogDao.getChangelogWithData(cube.id, changelogId);

    if (changelog?.changelog) sanitizeChangelog(changelog.changelog);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeChangelogPage',
      {
        cube,
        changelog,
      },
      {
        title: `${abbreviate(cube.name)} - Changelog`,
        metadata: generateMeta(
          `Cube Cobra Changelog: ${cube.name}`,
          cube.brief,
          cube.image.uri,
          `${baseUrl}/cube/changelog/${cubeId}/${changelogId}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/about/${req.params.cubeId}?view=changelog`);
  }
};

export const pitDownloadHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.cubeId!;
    const changelogId = req.params.changelogId!;

    const cube = await cubeDao.getById(cubeId);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const changelog = await changelogDao.getChangelogWithData(cube.id, changelogId);
    if (!changelog) {
      req.flash('danger', 'Changelog not found');
      return redirect(req, res, `/cube/about/${cubeId}?view=changelog`);
    }

    const currentCards = await cubeDao.getCards(cube.id);
    const pitCards = await reconstructCubeAtChangelog(cube.id, changelog.date, currentCards, changelogDao);

    // Populate details on all boards
    for (const [boardName, list] of Object.entries(pitCards)) {
      if (boardName !== 'id' && Array.isArray(list)) {
        for (const card of list as Card[]) {
          if (!card.details) {
            card.details = cardFromId(card.cardID);
          }
        }
      }
    }

    const dateStr = new Date(changelog.date).toISOString().split('T')[0];
    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}_${dateStr}.csv`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`${CSV_HEADER}\r\n`);

    for (const [boardName, list] of Object.entries(pitCards)) {
      if (boardName !== 'id' && Array.isArray(list)) {
        for (const card of list as Card[]) {
          writeCard(res, card, boardName);
        }
      }
    }

    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/about/${req.params.cubeId}?view=changelog`);
  }
};

export const pitCompareHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.cubeId!;
    const changelogId = req.params.changelogId!;

    const cube = await cubeDao.getById(cubeId);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const changelog = await changelogDao.getChangelogWithData(cube.id, changelogId);
    if (!changelog) {
      req.flash('danger', 'Changelog not found');
      return redirect(req, res, `/cube/about/${cubeId}?view=changelog`);
    }

    const currentCards = await cubeDao.getCards(cube.id);
    const pitCards = await reconstructCubeAtChangelog(cube.id, changelog.date, currentCards, changelogDao);

    const { allCards, inBothIndices, onlyAIndices, onlyBIndices } = await compareCubes(pitCards, currentCards);

    const dateStr = new Date(changelog.date).toLocaleDateString();
    const baseUrl = getBaseUrl();
    // Strip card details — the client rehydrates via cardDetailsCache.
    const strippedCards = allCards.map((card: any, index: number) => {
      const { details: _details, ...rest } = card || {};
      return { ...rest, index };
    });
    return render(
      req,
      res,
      'CubeComparePage',
      {
        cube,
        cubeB: cube,
        onlyA: onlyAIndices,
        onlyB: onlyBIndices,
        both: inBothIndices,
        cards: strippedCards,
        pitDate: dateStr,
        changelogId,
      },
      {
        title: `${abbreviate(cube.name)} - Point in Time Compare (${dateStr})`,
        metadata: generateMeta(
          `Cube Cobra PIT Compare: ${cube.name}`,
          `Comparing "${cube.name}" at ${dateStr} to present`,
          cube.image.uri,
          `${baseUrl}/cube/changelog/${cubeId}/${changelogId}/compare`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/about/${req.params.cubeId}?view=changelog`);
  }
};

export const pitListHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.cubeId!;
    const changelogId = req.params.changelogId!;

    const cube = await cubeDao.getById(cubeId);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const changelog = await changelogDao.getChangelogWithData(cube.id, changelogId);
    if (!changelog) {
      req.flash('danger', 'Changelog not found');
      return redirect(req, res, `/cube/about/${cubeId}?view=changelog`);
    }

    const currentCards = await cubeDao.getCards(cube.id);
    const pitCards = await reconstructCubeAtChangelog(cube.id, changelog.date, currentCards, changelogDao);

    // Don't populate details — the client rehydrates via cardDetailsCache.
    // Just strip any details that snuck through reconstruction.
    const cards: Record<string, Card[]> = {};
    for (const [boardName, list] of Object.entries(pitCards)) {
      if (boardName !== 'id' && Array.isArray(list)) {
        cards[boardName] = (list as Card[]).map((card: any) => {
          const { details: _details, ...rest } = card || {};
          return rest as Card;
        });
      }
    }

    const dateStr = new Date(changelog.date).toLocaleDateString();
    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubePITListPage',
      {
        cube,
        cards,
        date: dateStr,
        changelogId,
      },
      {
        title: `${abbreviate(cube.name)} - Point in Time List (${dateStr})`,
        metadata: generateMeta(
          `Cube Cobra PIT List: ${cube.name}`,
          `${cube.name} card list at ${dateStr}`,
          cube.image.uri,
          `${baseUrl}/cube/changelog/${cubeId}/${changelogId}/list`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/about/${req.params.cubeId}?view=changelog`);
  }
};

export const dateResolveHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.cubeId!;
    const dateParam = req.query.date as string | undefined;

    if (!dateParam) {
      req.flash('danger', 'Date parameter is required.');
      return redirect(req, res, `/cube/about/${cubeId}?view=changelog`);
    }

    const dateMs = parseInt(dateParam, 10);
    if (isNaN(dateMs)) {
      req.flash('danger', 'Invalid date parameter.');
      return redirect(req, res, `/cube/about/${cubeId}?view=changelog`);
    }

    const cube = await cubeDao.getById(cubeId);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const changelog = await changelogDao.getNearest(cube.id, dateMs);
    if (!changelog) {
      req.flash('danger', 'No changelogs found for this cube.');
      return redirect(req, res, `/cube/about/${cubeId}?view=changelog`);
    }

    return redirect(req, res, `/cube/changelog/${cube.id}/${changelog.id}/list`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/about/${req.params.cubeId}?view=changelog`);
  }
};

export const routes = [
  {
    path: '/:cubeId/at',
    method: 'get',
    handler: [dateResolveHandler],
  },
  {
    path: '/:cubeId/:changelogId/download',
    method: 'get',
    handler: [pitDownloadHandler],
  },
  {
    path: '/:cubeId/:changelogId/compare',
    method: 'get',
    handler: [pitCompareHandler],
  },
  {
    path: '/:cubeId/:changelogId/list',
    method: 'get',
    handler: [pitListHandler],
  },
  {
    path: '/:cubeId/:changelogId',
    method: 'get',
    handler: [changelogDetailHandler],
  },
  {
    path: '/:id',
    method: 'get',
    handler: [changelogHandler],
  },
];
