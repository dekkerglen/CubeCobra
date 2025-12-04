import catalog from 'serverutils/cardCatalog';
import { csrfProtection } from 'src/router/middleware';

import { Request, Response } from '../../../../types/express';

export const getCombos = async (req: Request, res: Response) => {
  try {
    const oracles = req.body.oracles;

    const indexes = oracles.map((oracle: string) => catalog.oracleToIndex[oracle]);

    const combos = [];

    const nodes = [catalog.comboTree];

    while (nodes.length > 0) {
      const node = nodes.pop()!;
      if (node['$']) {
        for (const id of node['$']) {
          const variant = catalog.comboDict[id];
          combos.push(variant);
        }
      }
      for (const index of indexes) {
        if (node.c && node.c[index]) {
          nodes.push(node.c[index]);
        }
      }
    }

    return res.status(200).json({
      combos,
    });
  } catch (error) {
    return res.status(500).json({ error: `Internal server error: ${(error as Error).message}` });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [csrfProtection, getCombos],
  },
];
