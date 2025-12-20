import { CUBE_VISIBILITY, PRICE_VISIBILITY } from '@utils/datatypes/Cube';
import Cube from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth, recaptcha } from 'router/middleware';
import { getImageData } from 'serverutils/imageutil';
import { handleRouteError, redirect } from 'serverutils/render';
import { hasProfanity } from 'serverutils/util';
import { v4 as uuidv4 } from 'uuid';

import { Request, Response } from '../../../types/express';

export const addHandler = async (req: Request, res: Response) => {
  try {
    const {
      body: { name },
      user,
    } = req;

    if (!user) {
      req.flash('danger', 'You must be logged in to create a cube.');
      return redirect(req, res, '/login');
    }

    if (!name || name.length < 5 || name.length > 100) {
      req.flash('danger', 'Cube name should be at least 5 characters long, and shorter than 100 characters.');
      return redirect(req, res, `/user/view/${user!.id}`);
    }

    if (hasProfanity(name)) {
      req.flash('danger', 'Cube name contains a banned word. If you feel this was a mistake, please contact us.');
      return redirect(req, res, `/user/view/${user!.id}`);
    }

    // if this user has two empty cubes, we deny them from making a new cube
    const cubes = await cubeDao.queryByOwner(user.id);

    const emptyCubes = cubes.items.filter((cube) => cube.cardCount === 0);

    if (emptyCubes.length >= 2) {
      req.flash(
        'danger',
        'You may only have two empty cubes at a time. To create a new cube, please delete an empty cube, or add cards to it.',
      );
      return redirect(req, res, `/user/view/${user!.id}`);
    }

    const now = Date.now().valueOf();
    const imageName = 'doubling cube [10e-321]';
    const cube: Cube = {
      id: uuidv4(),
      shortId: '',
      name: name,
      owner: user!,
      imageName: imageName,
      image: getImageData(imageName),
      description: 'This is a brand new cube!',
      date: now,
      dateCreated: now,
      dateLastUpdated: now,
      visibility: CUBE_VISIBILITY.PUBLIC,
      priceVisibility: PRICE_VISIBILITY.PUBLIC,
      featured: false,
      categoryPrefixes: [],
      tagColors: [],
      defaultFormat: -1,
      numDecks: 0,
      defaultSorts: [],
      showUnsorted: false,
      collapseDuplicateCards: false,
      formats: [],
      following: [],
      defaultStatus: 'Not Owned',
      defaultPrinting: 'recent',
      disableAlerts: false,
      basics: [
        '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
        '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
        '19e71532-3f79-4fec-974f-b0e85c7fe701',
        '8365ab45-6d78-47ad-a6ed-282069b0fabc',
        '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
      ],
      tags: [],
      keywords: [],
      cardCount: 0,
      version: 1,
    };

    await cubeDao.putNewCube(cube, {
      mainboard: [],
      maybeboard: [],
    });

    req.flash('success', 'Cube created!');
    return redirect(req, res, `/cube/view/${cube.id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/user/view/${req.user!.id}`);
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, recaptcha, addHandler],
  },
];
