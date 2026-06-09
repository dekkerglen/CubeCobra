import { cubeDao, recordDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { signRecordToken } from 'serverutils/recordShareToken';

import { Request, Response } from '../../../../types/express';

// Owner-only: returns a contribution token for a record. The token is never
// embedded in the public record page — only fetched on demand by the owner's
// share modal.
export const shareTokenHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    return res.status(400).json({ success: false, message: 'Invalid record ID' });
  }
  const record = await recordDao.getById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  const cube = await cubeDao.getById(record.cube);
  if (!isCubeViewable(cube, req.user) || !isCubeEditable(cube, req.user)) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  return res.json({ success: true, token: signRecordToken(record.id) });
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, shareTokenHandler],
  },
];
