import { draftDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../../types/express';
import { DRAFT_TYPES } from '@utils/datatypes/Draft';

export const submitgriddraftHandler = async (req: Request, res: Response) => {
  try {
    if (!req.body.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Draft ID is required',
      });
    }

    const draft = await draftDao.getById(req.body.id);

    if (!draft) {
      return res.status(404).send({
        success: 'false',
        message: 'Draft not found',
      });
    }

    if (draft.type !== DRAFT_TYPES.GRID) {
      return res.status(400).send({
        success: 'false',
        message: 'Draft is not a grid draft',
      });
    }

    const { seats } = req.body;

    draft.seats = seats;
    draft.complete = true;

    await draftDao.update(draft);

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error submitting grid draft',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [ensureAuth, submitgriddraftHandler],
  },
];
