import catalog from 'serverutils/cardCatalog';

import { comboDao } from 'dynamo/daos';
import { Request, Response } from 'types/express';

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

    // Fetch from DynamoDB by traversing comboTree
    const oracleIndex = catalog.oracleToIndex[oracleId];

    if (oracleIndex === undefined) {
      return res.status(200).json({ combos: [] });
    }

    const variantIds: string[] = [];

    // Traverse the entire tree looking for paths that include this card
    const traverse = (node: any, path: number[]) => {
      if (node['$'] && path.includes(oracleIndex)) {
        // This path includes our target oracle - collect variant IDs
        variantIds.push(...node['$']);
      }

      if (node.c) {
        for (const idx in node.c) {
          traverse(node.c[idx], [...path, parseInt(idx)]);
        }
      }
    };

    traverse(catalog.comboTree, []);

    let combos: any[] = [];
    if (variantIds.length > 0) {
      const fetchedCombos = await comboDao.getBatchByVariantIds(variantIds);
      combos = fetchedCombos.filter((combo) => combo !== undefined);
    }

    return res.status(200).json({ combos });
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
    handler: [getCardCombos],
  },
];
