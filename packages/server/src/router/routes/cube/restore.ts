import { Changes } from '@utils/datatypes/Card';
import { changelogDao, cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

/**
 * GET handler to display the restore page with version history
 */
export const restorePageHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    // Only cube owner can restore
    if (!req.user || cube.owner.id !== req.user.id) {
      req.flash('danger', 'You do not have permission to restore this cube');
      return redirect(req, res, `/cube/overview/${req.params.id}`);
    }

    // Get version history from S3
    const versions = await cubeDao.listCubeCardsVersions(cube.id);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeRestorePage',
      {
        cube,
        versions,
      },
      {
        title: `${abbreviate(cube.name)} - Restore`,
        metadata: generateMeta(
          `Restore ${cube.name}`,
          `View and restore previous versions of ${cube.name}`,
          cube.image.uri,
          `${baseUrl}/cube/restore/${req.params.id}`,
        ),
        noindex: true, // Don't index restore pages
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/overview/${req.params.id}`);
  }
};

/**
 * POST handler to restore a cube to a specific version
 */
export const restoreHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.id!;
    const { versionId } = req.body;

    if (!versionId) {
      req.flash('danger', 'Version ID is required');
      return redirect(req, res, `/cube/restore/${cubeId}`);
    }

    const cube = await cubeDao.getById(cubeId);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    // Only cube owner can restore
    if (!req.user || cube.owner.id !== req.user.id) {
      req.flash('danger', 'You do not have permission to restore this cube');
      return redirect(req, res, `/cube/overview/${cubeId}`);
    }

    // Get the current cards
    const currentCards = await cubeDao.getCards(cubeId);

    // Get the version to restore
    const versionCards = await cubeDao.getCubeCardsVersion(cubeId, versionId);

    // Calculate the differences for the changelog
    const currentCardIds = new Map(currentCards.mainboard.map((c, idx) => [c.cardID, { card: c, index: idx }]));
    const versionCardIds = new Map(versionCards.mainboard.map((c) => [c.cardID, c]));

    const adds = versionCards.mainboard.filter((c) => !currentCardIds.has(c.cardID));

    const removes = currentCards.mainboard
      .filter((c) => !versionCardIds.has(c.cardID))
      .map((c) => {
        const info = currentCardIds.get(c.cardID);
        return {
          index: info?.index ?? 0,
          oldCard: c,
        };
      });

    // Update the cube with the restored version
    await cubeDao.updateCards(cubeId, versionCards);

    // Create a changelog entry using the DAO's createChangelog method
    const changelog: Changes = {
      mainboard: {
        adds: adds.length > 0 ? adds : undefined,
        removes: removes.length > 0 ? removes : undefined,
      },
    };

    await changelogDao.createChangelog(changelog, cube.id);

    req.flash('success', 'Cube successfully restored to the selected version');
    return redirect(req, res, `/cube/list/${cubeId}`);
  } catch (err) {
    req.flash('danger', `Failed to restore cube: ${(err as Error).message}`);
    return handleRouteError(req, res, err as Error, `/cube/restore/${req.params.id}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [csrfProtection, ensureAuth, restorePageHandler],
  },
  {
    path: '/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, restoreHandler],
  },
];
