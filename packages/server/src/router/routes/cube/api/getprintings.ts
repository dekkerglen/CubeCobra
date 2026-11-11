import { CardDetails, isPrintingPreference } from '@utils/datatypes/Card';
import { body } from 'express-validator';
import { jsonValidationErrors } from 'router/middleware';
import { getPreferredPrinting } from 'serverutils/carddb';
import { isValidUUID } from 'serverutils/validation';

import { Request, Response } from '../../../../types/express';

// Resolves each card id to the printing of that card a printing preference picks, for moving a
// whole board onto one preference at once. Only ids that would move are returned, keyed by the
// id sent, so a board already on the preference costs next to nothing to check.
export const getprintingsHandler = async (req: Request, res: Response) => {
  try {
    const { ids, printing } = req.body as { ids: string[]; printing: string };

    if (!isPrintingPreference(printing)) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid printing preference',
      });
    }

    const printings: Record<string, CardDetails> = {};
    for (const id of new Set(ids)) {
      const preferred = getPreferredPrinting(id, printing);
      if (preferred && !preferred.error && preferred.scryfall_id !== id) {
        printings[id] = preferred;
      }
    }

    return res.status(200).send({
      success: 'true',
      printings,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving printings',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [
      body('ids', 'ids must be an array.').isArray(),
      body('ids.*').custom((value) => {
        if (typeof value !== 'string' || !isValidUUID(value)) {
          throw new Error('Each ID must be a valid UUID.');
        }
        return true;
      }),
      jsonValidationErrors,
      getprintingsHandler,
    ],
  },
];
