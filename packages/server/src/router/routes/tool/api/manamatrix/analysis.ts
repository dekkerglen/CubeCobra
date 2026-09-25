import { manaMatrixCellStatsDao, manaMatrixPuzzleDao } from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import { whenCardDbReady } from 'serverutils/cardCatalog';
import { analyzePuzzle } from 'serverutils/manamatrix/analysis';
import { userOrIpKey } from 'serverutils/rateLimitKeys';

import { Request, Response } from '../../../../../types/express';

// The first analysis of a date does a full catalog pass; keep hammering off.
const analysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: userOrIpKey,
  message: '429: Too Many Requests',
});

/**
 * Community answer breakdown for a puzzle: every valid card per cell with how
 * many players gave it. The client only offers this after the player has
 * submitted, but the data itself is no more revealing than running the
 * printed filters through card search.
 */
export const getManaMatrixAnalysisHandler = async (req: Request, res: Response) => {
  try {
    const date = req.params.date!;
    const puzzle = await manaMatrixPuzzleDao.getByDate(date);
    if (!puzzle) {
      return res.status(404).json({ error: 'No ManaMatrix puzzle for that date' });
    }

    await whenCardDbReady();
    const cellStats = await manaMatrixCellStatsDao.getForPuzzle(date);

    return res.status(200).json({
      success: true,
      analysis: analyzePuzzle(puzzle, cellStats),
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error analyzing ManaMatrix puzzle' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:date([0-9]{4}-[0-9]{2}-[0-9]{2})',
    handler: [analysisLimiter, getManaMatrixAnalysisHandler],
  },
];
