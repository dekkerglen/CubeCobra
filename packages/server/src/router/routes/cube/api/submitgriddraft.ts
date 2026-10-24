import { DRAFT_TYPES, mergeSubmittedSeats } from '@utils/datatypes/Draft';
import { draftDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../../types/express';

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

    const ownerId = typeof draft.owner === 'string' ? draft.owner : draft.owner?.id;
    if (!req.user || !ownerId || ownerId !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (draft.complete) {
      return res.status(409).send({
        success: 'false',
        message: 'This draft has already been submitted.',
      });
    }

    // Only the deck-building fields come from the client; owner, bot and name stay as stored.
    const seats = mergeSubmittedSeats(draft.seats, req.body.seats, draft.cards.length, [
      'mainboard',
      'sideboard',
      'pickorder',
      'pickedIndices',
    ]);
    if (!seats) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid draft seats',
      });
    }

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
