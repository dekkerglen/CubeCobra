import catalog from 'serverutils/cardCatalog';

import { comboDao } from 'dynamo/daos';
import { Request, Response } from 'types/express';

export const getCombos = async (req: Request, res: Response) => {
  try {
    const oracles = req.body.oracles;

    const indexes = oracles.map((oracle: string) => catalog.oracleToIndex[oracle]);

    // Collect variant IDs from comboTree
    const variantIds: string[] = [];
    const nodes = [catalog.comboTree];

    while (nodes.length > 0) {
      const node = nodes.pop()!;
      if (node['$']) {
        variantIds.push(...node['$']);
      }
      for (const index of indexes) {
        if (node.c && node.c[index]) {
          nodes.push(node.c[index]);
        }
      }
    }

    // Fetch combos from DynamoDB
    let combos: any[] = [];

    if (variantIds.length > 0) {
      const fetchedCombos = await comboDao.getBatchByVariantIds(variantIds);
      combos = fetchedCombos.filter((combo) => combo !== undefined);
    }

    return res.status(200).json({ combos });
  } catch (error) {
    return res.status(500).json({ error: `Internal server error: ${(error as Error).message}` });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [getCombos],
  },
];
