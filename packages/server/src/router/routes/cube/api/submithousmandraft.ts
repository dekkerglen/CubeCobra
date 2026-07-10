import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { draftDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../../types/express';

export const submithousmandraftHandler = async (req: Request, res: Response) => {
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

    if (draft.type !== DRAFT_TYPES.HOUSMAN) {
      return res.status(400).send({
        success: 'false',
        message: 'Draft is not a housman draft',
      });
    }

    const { seats, log } = req.body;

    draft.seats = seats;
    // The exchange log powers the post-draft pick-by-pick breakdown. Persist it if provided.
    if (Array.isArray(log)) {
      draft.HousmanLog = log;
    }
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
      message: 'Error submitting housman draft',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [ensureAuth, submithousmandraftHandler],
  },
];
