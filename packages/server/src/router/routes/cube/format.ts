import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const formatAddHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/list/404');
    }
    if (!cube || cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Formats can only be changed by cube owner.');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
    }

    let message = '';
    const { id, serializedFormat } = req.body;
    const format = JSON.parse(serializedFormat);

    format.defaultSeats = Number.parseInt(format.defaultSeats, 10);
    if (Number.isNaN(format.defaultSeats)) format.defaultSeats = 8;
    if (format.defaultSeats < 2 || format.defaultSeats > 16) {
      req.flash('danger', 'Default seat count must be between 2 and 16');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
    }

    if (id === '-1') {
      if (!cube.formats) {
        cube.formats = [];
      }
      cube.formats.push(format);
      message = 'Custom format successfully added.';
    } else {
      cube.formats[req.body.id] = format;
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

    if (!cube || cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid!)}`);
    }
    if (indexNum < 0 || indexNum >= cube.formats.length) {
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
    method: 'get',
    handler: [csrfProtection, ensureAuth, formatRemoveHandler],
  },
];
