import Cube from 'dynamo/models/cube';
import { csrfProtection, ensureAuth, recaptcha } from 'router/middleware';
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
    if (!name || name.length < 5 || name.length > 100) {
      req.flash('danger', 'Cube name should be at least 5 characters long, and shorter than 100 characters.');
      return redirect(req, res, `/user/view/${user!.id}`);
    }

    if (hasProfanity(name)) {
      req.flash('danger', 'Cube name contains a banned word. If you feel this was a mistake, please contact us.');
      return redirect(req, res, `/user/view/${user!.id}`);
    }

    // if this user has two empty cubes, we deny them from making a new cube
    const cubes = await Cube.getByOwner(user!.id);

    const emptyCubes = cubes.items.filter((cube) => cube.cardCount === 0);

    if (emptyCubes.length >= 2) {
      req.flash(
        'danger',
        'You may only have two empty cubes at a time. To create a new cube, please delete an empty cube, or add cards to it.',
      );
      return redirect(req, res, `/user/view/${user!.id}`);
    }

    // if this account is younger than a week, we deny them from making a new cube
    if ((req.user as any).dateCreated && Date.now() - (req.user as any).dateCreated < 1000 * 60 * 60 * 24 * 7) {
      const totalCubes = cubes.items.length;

      if (totalCubes > 2) {
        req.flash('danger', 'You may only have two cubes until your account is a week old.');
        return redirect(req, res, `/user/view/${user!.id}`);
      }
    }

    const cube = {
      id: uuidv4(),
      shortId: null,
      name: name,
      owner: user!.id,
      imageName: 'doubling cube [10e-321]',
      description: 'This is a brand new cube!',
      date: Date.now().valueOf(),
      visibility: Cube.VISIBILITY.PUBLIC,
      priceVisibility: Cube.PRICE_VISIBILITY.PUBLIC,
      featured: false,
      tagColors: [],
      defaultFormat: -1,
      numDecks: 0,
      defaultSorts: [],
      showUnsorted: false,
      collapseDuplicateCards: false,
      formats: [],
      following: [],
      defaultStatus: 'Not Owned',
      defaultPrinting: 'recent' as const,
      disableAlerts: false,
      basics: [
        '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
        '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
        '19e71532-3f79-4fec-974f-b0e85c7fe701',
        '8365ab45-6d78-47ad-a6ed-282069b0fabc',
        '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
      ],
      tags: [],
      cardCount: 0,
    };

    await Cube.putNewCube(cube);

    await Cube.putCards({
      id: cube.id,
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
