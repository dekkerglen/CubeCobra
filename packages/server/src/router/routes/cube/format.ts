import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';
import { sanitizeDraftFormat } from './format/update';

export const formatAddHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/list/404');
    }
    if (!cube || !isCubeEditable(cube, req.user)) {
      req.flash('danger', 'Formats can only be changed by cube owner.');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
    }

    let message = '';
    const { id, serializedFormat } = req.body;
    let rawFormat: any;
    try {
      rawFormat = JSON.parse(serializedFormat);
    } catch {
      rawFormat = null;
    }
    if (!rawFormat || typeof rawFormat !== 'object') {
      req.flash('danger', 'Invalid format data.');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
    }

    const defaultSeats = Number.parseInt(rawFormat.defaultSeats, 10);
    if (!Number.isNaN(defaultSeats) && (defaultSeats < 2 || defaultSeats > 16)) {
      req.flash('danger', 'Default seat count must be between 2 and 16');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
    }

    const { format, error } = sanitizeDraftFormat(rawFormat);
    if (!format) {
      req.flash('danger', error || 'Invalid format data.');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
    }

    if (String(id) === '-1') {
      if (!cube.formats) {
        cube.formats = [];
      }
      cube.formats.push(format);
      message = 'Custom format successfully added.';
    } else {
      // Only an existing format can be edited: an arbitrary index would create a huge sparse
      // array (or mutate the array object itself) when the cube is saved.
      const index = /^\d+$/.test(String(id)) ? Number.parseInt(String(id), 10) : NaN;
      if (!Number.isInteger(index) || index < 0 || index >= (cube.formats?.length ?? 0)) {
        req.flash('danger', 'Invalid format index.');
        return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
      }
      cube.formats[index] = format;
      message = 'Custom format successfully edited.';
    }

    await cubeDao.update(cube);
    req.flash('success', message);
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
  }
};

export const formatRemoveHandler = async (req: Request, res: Response) => {
  try {
    const { cubeid, index } = req.params;
    const indexNum = parseInt(index!, 10);

    const cube = await cubeDao.getById(cubeid!);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!cube || !isCubeEditable(cube, req.user)) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid!)}`);
    }
    if (!Number.isInteger(indexNum) || indexNum < 0 || indexNum >= (cube.formats?.length ?? 0)) {
      req.flash('danger', 'Invalid format index.');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid!)}`);
    }

    cube.formats.splice(indexNum, 1);
    // update defaultFormat if necessary
    if (indexNum === cube.defaultFormat) {
      //When the current default format is deleted, revert to no default specified
      cube.defaultFormat = -1;
    } else if (indexNum < cube.defaultFormat) {
      /* If the format deleted isn't the default but is a custom format before it in the list, shift
       * the default format index to keep the alignment
       */
      cube.defaultFormat -= 1;
    }

    await cubeDao.update(cube);

    req.flash('success', 'Format removed.');
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid!)}`);
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    req.flash('danger', 'Error removing format.');
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.cubeid!)}`);
  }
};

export const routes = [
  {
    path: '/add/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, formatAddHandler],
  },
  {
    path: '/remove/:cubeid/:index',
    method: 'post',
    handler: [csrfProtection, ensureAuth, formatRemoveHandler],
  },
];
