import { PrintingPreference } from '@utils/datatypes/Card';
import { GridTightnessPreference, YourCubesSortOrder } from '@utils/datatypes/User';
import { userDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return redirect(req, res, '/user/login');
    }

    const user = await userDao.getByIdWithSensitiveData(req.user.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/user/account?nav=display');
    }

    const errors = [];
    if (!['system', 'light', 'dark'].includes(req.body.theme)) {
      errors.push({ msg: 'Theme must be valid.' });
    }

    if (![PrintingPreference.RECENT, PrintingPreference.FIRST].includes(req.body.defaultPrinting)) {
      errors.push({ msg: 'Printing must be valid.' });
    }

    if (![GridTightnessPreference.TIGHT, GridTightnessPreference.LOOSE].includes(req.body.gridTightness)) {
      errors.push({ msg: 'Grid tightness must be valid.' });
    }

    if (![YourCubesSortOrder.ALPHA, YourCubesSortOrder.LASTUPDATED].includes(req.body.yourCubesSortOrder)) {
      errors.push({ msg: 'Your cubes sort order must be valid.' });
    }

    if (errors.length > 0) {
      req.flash('danger', 'Error updating display settings: ' + errors.map((error) => error.msg).join(', '));
      return redirect(req, res, '/user/account?nav=display');
    }

    user.theme = req.body.theme;
    user.hideFeatured = req.body.hideFeatured === 'true';
    user.defaultPrinting = req.body.defaultPrinting;
    user.gridTightness = req.body.gridTightness;
    user.autoBlog = req.body.autoBlog === 'true';
    user.yourCubesSortOrder = req.body.yourCubesSortOrder;

    await userDao.update(user as any);

    req.flash('success', 'Your display preferences have been updated.');
    return redirect(req, res, '/user/account');
  } catch (err) {
    req.flash('danger', `Could not save preferences: ${(err as Error).message}`);
    return redirect(req, res, '/user/account?nav=display');
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
