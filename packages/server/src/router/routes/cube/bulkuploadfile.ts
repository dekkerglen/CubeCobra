import Cube from 'dynamo/models/cube';
import { ensureAuth } from 'router/middleware';
import { bulkUpload } from 'serverutils/cube';
import { isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const bulkUploadFileHandler = async (req: Request, res: Response) => {
  try {
    const split = req.body.file.split(',');
    const encodedFile = split[1];

    // decode base64
    const list = Buffer.from(encodedFile, 'base64').toString('utf8');

    const cube = await Cube.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
    }

    await bulkUpload(req, res, list, cube);
    return null;
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/list/${encodeURIComponent(req.params.id!)}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post' as const,
    handler: [ensureAuth, bulkUploadFileHandler],
  },
];
