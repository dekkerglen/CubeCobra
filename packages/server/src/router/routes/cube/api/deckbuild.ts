import { deckbuild } from 'serverutils/draftbots';

import { Request, Response } from '../../../../types/express';

export const deckbuildHandler = async (req: Request, res: Response) => {
  try {
    const { pool, basics } = req.body;

    if (!pool || !basics) {
      return res.status(400).send({
        success: 'false',
        message: 'Pool and basics are required',
      });
    }

    const { mainboard, sideboard } = await deckbuild(pool, basics);

    return res.status(200).send({
      success: 'true',
      mainboard,
      sideboard,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [deckbuildHandler],
  },
];
