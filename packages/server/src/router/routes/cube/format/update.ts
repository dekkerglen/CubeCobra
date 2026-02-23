import { DraftFormat } from '@utils/datatypes/Draft';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';

export const updateDraftFormatsHandler = async (req: Request, res: Response) => {
  try {
    // Parse JSON from form fields
    const formatsJson = req.body.formats;
    const enableDraft = req.body.enableDraft === 'true';
    const enableMultiplayer = req.body.enableMultiplayer === 'true';
    const enableSealed = req.body.enableSealed === 'true';
    const enableGrid = req.body.enableGrid === 'true';
    const basicsBoard = req.body.basicsBoard || 'None';
    const defaultFormat = parseInt(req.body.defaultFormat ?? '-1', 10);

    let formats: DraftFormat[];

    try {
      formats = JSON.parse(formatsJson);
    } catch (_err) {
      req.flash('danger', 'Invalid data format');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
    }

    // Validate formats
    if (!Array.isArray(formats)) {
      req.flash('danger', 'Invalid formats data');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
    }

    for (const format of formats) {
      if (!format.title || typeof format.title !== 'string') {
        req.flash('danger', 'Each format must have a title');
        return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
      }
      if (!Array.isArray(format.packs) || format.packs.length === 0) {
        req.flash('danger', `Format "${format.title}" must have at least one pack`);
        return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
      }
    }

    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found.');
      return redirect(req, res, '/404');
    }

    if (!cube || cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Unauthorized');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
    }

    // Update cube with new formats
    cube.formats = formats;

    // Update standard draft format toggles (stored as disable flags)
    cube.disableDraft = !enableDraft;
    cube.disableMultiplayer = !enableMultiplayer;
    cube.disableSealed = !enableSealed;
    cube.disableGrid = !enableGrid;
    cube.basicsBoard = basicsBoard;

    // Validate defaultFormat is in range
    cube.defaultFormat = defaultFormat >= -1 && defaultFormat < formats.length ? defaultFormat : -1;

    await cubeDao.update(cube);

    req.flash('success', 'Draft formats updated successfully.');
    return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
  } catch (err) {
    req.logger.error('Error updating draft formats:', err);
    req.flash('danger', 'Error updating draft formats: ' + (err as Error).message);
    return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, updateDraftFormatsHandler],
  },
];
