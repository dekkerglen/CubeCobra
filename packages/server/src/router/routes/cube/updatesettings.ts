import { CARD_STATUSES, PrintingPreference } from '@utils/datatypes/Card';
import { CUBE_VISIBILITY, PRICE_VISIBILITY } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const updateSettingsHandler = async (req: Request, res: Response) => {
  try {
    const { priceVisibility, disableAlerts, defaultStatus, defaultPrinting, visibility } = req.body;

    const errors = [];
    if (priceVisibility !== 'true' && priceVisibility !== 'false') {
      errors.push({ msg: 'Invalid Price visibility' });
    }
    if (disableAlerts !== 'true' && disableAlerts !== 'false') {
      errors.push({ msg: 'Invalid value for disableAlerts' });
    }
    if (!CARD_STATUSES.includes(defaultStatus)) {
      errors.push({ msg: 'Status must be valid.' });
    }
    if (![PrintingPreference.RECENT, PrintingPreference.FIRST].includes(defaultPrinting)) {
      errors.push({ msg: 'Printing must be valid.' });
    }
    if (!Object.values(CUBE_VISIBILITY).includes(visibility)) {
      errors.push({ msg: 'Visibility must be valid' });
    }

    if (errors.length > 0) {
      req.flash('danger', 'Error updating cube: ' + errors.map((error) => error.msg).join(', '));
      return redirect(req, res, '/cube/overview/' + req.params.id);
    }

    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found.');
      return redirect(req, res, '/404');
    }

    if (!cube || cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Unauthorized');
      return redirect(req, res, '/cube/overview/' + req.params.id);
    }

    const update = req.body;
    for (const field of ['visibility', 'defaultStatus', 'defaultPrinting']) {
      if (update[field] !== undefined) {
        (cube as any)[field] = update[field];
      }
    }
    cube.disableAlerts = update.disableAlerts === 'true';
    cube.priceVisibility = update.priceVisibility === 'true' ? PRICE_VISIBILITY.PUBLIC : PRICE_VISIBILITY.PRIVATE;

    await cubeDao.update(cube);
    req.flash('success', 'Settings updated successfully.');
    return redirect(req, res, '/cube/overview/' + req.params.id);
  } catch (err) {
    req.flash('danger', 'Error updating settings. ' + (err as Error).message);
    req.logger.error('Error updating settings:', err);
    return redirect(req, res, '/cube/overview/' + req.params.id);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, updateSettingsHandler],
  },
];
