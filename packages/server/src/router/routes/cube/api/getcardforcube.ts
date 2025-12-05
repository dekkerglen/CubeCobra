import { getMostReasonable } from '../../../../serverutils/carddb';
import { Request, Response } from '../../../../types/express';

export const getcardforcubeHandler = async (req: Request, res: Response) => {
  try {
    const { name, defaultPrinting } = req.body;

    if (!name) {
      return res.status(400).send({
        success: 'false',
        message: 'Card name is required',
      });
    }

    const card = getMostReasonable(name, defaultPrinting);
    if (card) {
      return res.status(200).send({
        success: 'true',
        card,
      });
    }
    return res.status(200).send({
      success: 'false',
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving card',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [getcardforcubeHandler],
  },
];
