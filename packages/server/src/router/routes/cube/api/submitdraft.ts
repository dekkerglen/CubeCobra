import Draft from 'dynamo/models/draft';
import { ensureAuth } from 'src/router/middleware';
import { Request, Response } from '../../../../types/express';

export const submitdraftHandler = async (req: Request, res: Response) => {
  try {
    if (!req.body.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Draft ID is required',
      });
    }

    const draft = await Draft.getById(req.body.id);

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

    draft.seats[index].seat = seat;
    draft.complete = true;

    await Draft.put(draft);

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
