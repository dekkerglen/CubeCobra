import Record from '../../../../dynamo/models/record';
import { csrfProtection, ensureAuth } from '../../../../routes/middleware';
import { Request, Response } from '../../../../types/express';

export const getRecordsHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;
  const cubeId = req.params.id;

  if (!cubeId) {
    return res.status(400).json({
      error: 'Invalid cube ID',
    });
  }

  try {
    const results = await Record.getByCube(cubeId, 20, lastKey || undefined);
    return res.status(200).json({
      records: results.items,
      lastKey: results.lastKey,
    });
  } catch {
    return res.status(500).json({
      error: 'Failed to retrieve records',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, getRecordsHandler],
  },
];
