import { draftDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../../types/express';

export const submitdraftHandler = async (req: Request, res: Response) => {
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

    const { seat } = req.body;

    const index = draft.seats.findIndex(({ owner }: any) => owner.id === req.body.owner);
    if (index === -1) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    const draftSeat = draft.seats[index];
    if (!draftSeat) {
      return res.status(404).send({
        success: 'false',
        message: 'Seat not found',
      });
    }

    // Update seat properties
    if (seat.mainboard) draftSeat.mainboard = seat.mainboard;
    if (seat.sideboard) draftSeat.sideboard = seat.sideboard;
    if (seat.pickorder) draftSeat.pickorder = seat.pickorder;
    if (seat.trashorder) draftSeat.trashorder = seat.trashorder;
    if (seat.pickedIndices) draftSeat.pickedIndices = seat.pickedIndices;
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
      message: 'Error submitting draft',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [ensureAuth, submitdraftHandler],
  },
];
