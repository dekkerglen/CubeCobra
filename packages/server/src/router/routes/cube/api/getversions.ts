import cardutil from '@utils/cardutil';
import { body } from 'express-validator';
import { jsonValidationErrors } from 'src/router/middleware';

import { cardFromId, getAllVersionIds } from '../../../../serverutils/carddb';
import { isValidUUID } from '../../../../serverutils/validation';
import { Request, Response } from '../../../../types/express';

export const getversionsParamHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Card ID is required',
      });
    }

    const cardIds = getAllVersionIds(cardFromId(req.params.id));

    const cards = cardIds.map((id) => Object.assign({}, cardFromId(id)));
    return res.status(200).send({
      success: 'true',
      cards,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving card versions',
    });
  }
};

export const getversionsBodyHandler = async (req: Request, res: Response) => {
  try {
    const allDetails = req.body.map((cardID: string) => cardFromId(cardID));
    const allIds = allDetails.map((cardDetails: any) => getAllVersionIds(cardDetails));
    const allVersions = allIds.map((versions: any) =>
      versions
        .map((id: string) => cardFromId(id))
        .sort((a: any, b: any) => -a.released_at.localeCompare(b.released_at)),
    );

    /* Build a map where every name from every version is a key. Necessary because now with printed name changes,
     * there can be multiple names across the versions of a card (when grouping by oracle id).
     */
    const result: Record<string, any[]> = {};
    allVersions.forEach((versions: any) => {
      const versionDetails = versions.map(
        ({ name, scryfall_id, oracle_id, full_name: fullName, image_normal, image_flip, prices, isExtra }: any) => ({
          scryfall_id,
          oracle_id,
          name,
          version: fullName.toUpperCase().substring(fullName.indexOf('[') + 1, fullName.indexOf(']')),
          image_normal,
          image_flip,
          prices,
          isExtra,
        }),
      );
      versions.forEach((card: any) => {
        const normalized = cardutil.normalizeName(card.name);
        // Filter based on isExtra which is true if this is the backside of a card.
        // Fixes duplicate versions listed in both the front and backsides
        result[normalized] = versionDetails
          .filter((c: any) => c.isExtra === card.isExtra)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .map(({ isExtra, ...rest }: any) => rest); // remove isExtra from the response objects
      });
    });

    return res.status(200).send({
      success: 'true',
      dict: result,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving card versions',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [getversionsParamHandler],
  },
  {
    method: 'post',
    path: '',
    handler: [
      body('', 'body must be an array.').isArray(),
      body('*')
        .custom((value) => {
          if (!(isValidUUID(value) || value === 'custom-card')) {
            throw new Error('body must contain uuids or custom-card');
          }
          return true;
        })
        .withMessage('Each ID must be a valid UUID or custom-card.'),
      jsonValidationErrors,
      getversionsBodyHandler,
    ],
  },
];
