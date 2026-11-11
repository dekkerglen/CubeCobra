import { cubeDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation, csrfProtection, ensureAuthJson } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../../types/express';

export const dropSchema = Joi.object({
  player: Joi.string().required(),
  dropped: Joi.boolean().required(),
}).unknown(false);

// Drops a player from a live event, or brings them back. A dropped player keeps their results
// and standing; they are only left out when the next round is paired. Answers with the whole
// list so the console renders the server's view, not its own guess.
export const dropHandler = async (req: Request, res: Response) => {
  try {
    const record = req.params.id ? await recordDao.getById(req.params.id) : undefined;
    if (!record) {
      return res.status(404).json({ success: 'false', message: 'Record not found' });
    }
    const cube = await cubeDao.getById(record.cube);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }
    if (!isCubeEditable(cube, req.user)) {
      return res
        .status(403)
        .json({ success: 'false', message: 'You do not have permission to edit a record for this cube' });
    }

    const { player, dropped } = req.body as { player: string; dropped: boolean };
    if (!record.players.some((listed) => listed.name === player)) {
      return res.status(400).json({ success: 'false', message: 'That player is not in this record' });
    }

    const others = (record.dropped ?? []).filter((name) => name !== player);
    record.dropped = dropped ? [...others, player] : others;
    record.dateLastUpdated = Date.now();
    await recordDao.update(record);

    return res.status(200).json({ success: 'true', dropped: record.dropped });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error updating dropped players' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureAuthJson, bodyValidation(dropSchema), dropHandler],
  },
];
