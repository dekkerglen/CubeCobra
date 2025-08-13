import { csrfProtection } from '../../../../routes/middleware';
import { Request, Response } from '../../../../types/express';
import catalog from '../../../../util/cardCatalog';

export const getCardCombos = async (req: Request, res: Response) => {
  try {
    const oracleId = req.body.oracleId;

    if (!oracleId) {
      return res.status(400).json({ error: 'Oracle ID is required' });
    }

    // Check if we have the oracle ID in our catalog
    if (!catalog.oracleToId[oracleId]) {
      console.log(`Oracle ID not found: ${oracleId}`);
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
      if (combo.uses.some((use) => use.card.oracleId === oracleId)) {
        combos.push(combo);
      }
    }

    console.log(`Found ${combos.length} combos for oracle ID ${oracleId}`);

    return res.status(200).json({
      combos,
    });
  } catch (error) {
    console.error('Error in getCardCombos:', error);
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
