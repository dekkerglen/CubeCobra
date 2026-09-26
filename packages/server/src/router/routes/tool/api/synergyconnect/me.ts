import { synergyConnectSubmissionDao, synergyConnectUserStatsDao } from 'dynamo/daos';
import { ensureAuthJson } from 'router/middleware';

import { Request, Response } from '../../../../../types/express';

/** The logged-in user's Synergy Connect stats and paginated submission history. */
export const getSynergyConnectMeHandler = async (req: Request, res: Response) => {
  try {
    // ensureAuthJson guarantees user exists but we're doing this for typescript
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { lastKey } = req.query;
    const limit = 30;

    let parsedLastKey: Record<string, any> | undefined;
    if (lastKey) {
      try {
        parsedLastKey = JSON.parse(lastKey as string);
      } catch (_parseError) {
        req.logger.error('Invalid lastKey format:', lastKey);
        return res.status(400).json({ error: 'Invalid lastKey format' });
      }
    }

    const [stats, submissions] = await Promise.all([
      synergyConnectUserStatsDao.getByUserId(req.user.id),
      synergyConnectSubmissionDao.getUserHistory(req.user.id, parsedLastKey, limit),
    ]);

    return res.status(200).json({
      success: true,
      stats: stats ?? null,
      submissions: submissions.items,
      hasMore: !!submissions.lastKey,
      lastKey: submissions.lastKey ? JSON.stringify(submissions.lastKey) : null,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching Synergy Connect user data' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [ensureAuthJson, getSynergyConnectMeHandler],
  },
];
