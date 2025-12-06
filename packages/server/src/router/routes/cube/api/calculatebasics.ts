import { calculateBasics } from 'serverutils/draftbots';
import { Request, Response } from '../../../../types/express';

export const calculatebasicsHandler = async (req: Request, res: Response) => {
  try {
    const { mainboard, basics } = req.body;

    if (!mainboard || !basics) {
      return res.status(400).send({
        success: 'false',
        message: 'Mainboard and basics are required',
      });
    }

    return res.status(200).send({
      success: 'true',
      basics: await calculateBasics(mainboard, basics),
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
    handler: [calculatebasicsHandler],
  },
];
