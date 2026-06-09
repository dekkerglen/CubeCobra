import { getMostReasonable } from 'serverutils/carddb';

import { Request, Response } from '../../../../types/express';

// Batch version of getcardforcube: resolve many card names in a single request
// (the upload/record flows resolve a whole decklist at once). Mirrors
// getMostReasonable per name; returns a parallel array (null where unresolved).
export const getcardsforcubeHandler = async (req: Request, res: Response) => {
  try {
    const { names, defaultPrinting } = req.body;

    if (!Array.isArray(names)) {
      return res.status(400).send({
        success: 'false',
        message: 'names array is required',
      });
    }

    const cards = names.map((name: unknown) =>
      typeof name === 'string' && name.length > 0 ? (getMostReasonable(name, defaultPrinting) ?? null) : null,
    );

    return res.status(200).send({
      success: 'true',
      cards,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving cards',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [getcardsforcubeHandler],
  },
];
