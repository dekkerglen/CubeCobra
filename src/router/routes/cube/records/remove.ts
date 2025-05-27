import Record from '../../../../dynamo/models/record';
import { csrfProtection, ensureAuth } from '../../../../routes/middleware';
import { Request, Response } from '../../../../types/express';

export const deleteRecordHandler = async (req: Request, res: Response) => {
  const recordId = req.params.id;

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
