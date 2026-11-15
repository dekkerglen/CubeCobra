import catalog from 'serverutils/cardCatalog';
import { getOracleForMl } from 'serverutils/carddb';
import { getModelVocabulary } from 'serverutils/modelPointer';

import { Request, Response } from '../../../../types/express';

// Rebuilt when the served model's vocabulary changes, since that decides which cards need a stand-in.
let cachedMlRemapping: { vocabulary: ReadonlySet<string> | null; remapping: Record<string, string> } | null = null;

function buildMlRemapping(): Record<string, string> {
  const vocabulary = getModelVocabulary();
  if (cachedMlRemapping && cachedMlRemapping.vocabulary === vocabulary) return cachedMlRemapping.remapping;

  const remapping: Record<string, string> = {};
  for (const oracle of Object.keys(catalog.metadatadict)) {
    const mlOracle = getOracleForMl(oracle, null);
    if (mlOracle && mlOracle !== oracle) {
      remapping[oracle] = mlOracle;
    }
  }

  cachedMlRemapping = { vocabulary, remapping };
  return remapping;
}

export const mlsubstitutionsHandler = async (req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    return res.status(200).json({
      success: true,
      remapping: buildMlRemapping(),
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to load ML substitutions',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: mlsubstitutionsHandler,
  },
];
