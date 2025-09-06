import p1p1PackModel from '../../../../dynamo/models/p1p1Pack';
import { Request, Response } from '../../../../types/express';

export const getMoreP1P1sHandler = async (req: Request, res: Response) => {
  try {
    const { cubeId } = req.params;
    const { lastKey } = req.body;

    if (!cubeId) {
      return res.status(400).json({ error: 'Cube ID is required' });
    }

    const result = await p1p1PackModel.queryByCube(cubeId, lastKey, 10);

    return res.status(200).json({
      success: true,
      packs: result.items || [],
      lastKey: result.lastKey,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching P1P1 packs' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:cubeId',
    handler: [getMoreP1P1sHandler],
  },
];