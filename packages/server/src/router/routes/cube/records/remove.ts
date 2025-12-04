import Cube from 'dynamo/models/cube';
import Record from 'dynamo/models/record';
import { isCubeEditable } from 'serverutils/cubefn';
import { csrfProtection, ensureAuth } from 'src/router/middleware';

import { Request, Response } from '../../../../types/express';

export const deleteRecordHandler = async (req: Request, res: Response) => {
  const recordId = req.params.id;

  if (!recordId) {
    return res.status(400).json({
      error: 'Invalid record ID',
    });
  }

  const record = await Record.getById(recordId);
  if (!record) {
    return res.status(404).json({
      error: 'Record not found',
    });
  }

  const cube = await Cube.getById(record.cube);
  const user = req.user;

  if (!user) {
    req.flash('danger', 'You must be logged in to remove a record');
    return res.status(401).json({
      error: 'Unauthorized',
    });
  }

  if (!isCubeEditable(cube, user)) {
    req.flash('danger', 'You do not have permission to remove a record for this cube');

    return res.status(403).json({
      error: 'Forbidden',
    });
  }

  try {
    await Record.delete(recordId);
    return res.status(204).send();
  } catch {
    return res.status(500).json({
      error: 'Failed to delete record',
    });
  }
};

export const routes = [
  {
    method: 'delete',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, deleteRecordHandler],
  },
];
