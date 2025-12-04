import { csrfProtection } from 'src/router/middleware';
import catalog from 'serverutils/cardCatalog';

import { Request, Response } from '../../../../types/express';

export const getCardCombos = async (req: Request, res: Response) => {
  try {
    const oracleId = req.body.oracleId;

    if (!oracleId) {
      return res.status(400).json({ error: 'Oracle ID is required' });
    }

    // Check if we have the oracle ID in our catalog
    if (!catalog.oracleToId[oracleId]) {
      return res.status(404).json({
        error: 'Card not found',
        combos: [],
      });
    }

    // Find all combos that include this card
    const combos = [];

    // Check every combo in the dictionary to see if it includes our card
    for (const comboId in catalog.comboDict) {
      const combo = catalog.comboDict[comboId];
      if (combo && combo.uses.some((use) => use.card.oracleId === oracleId)) {
        combos.push(combo);
      }
    }

    return res.status(200).json({
      combos,
    });
  } catch (error) {
    return res.status(500).json({
      error: `Internal server error: ${(error as Error).message}`,
      combos: [],
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [csrfProtection, getCardCombos],
  },
];
