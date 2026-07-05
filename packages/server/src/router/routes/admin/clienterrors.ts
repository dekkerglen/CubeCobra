import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { clampWindow, isMissingLogGroup, summarizeError } from 'serverutils/adminInsights';
import {
  binIntervalFor,
  logGroupFor,
  runCategoryTimeSeries,
  runInsightsQuery,
  runTimeSeries,
} from 'serverutils/cloudwatchInsights';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

const DEFAULT_WINDOW = 1440;
const MAX_ROWS = 200;

export const clientErrorsHandler = async (req: Request, res: Response) => {
  return render(req, res, 'AdminClientErrorsPage', {
    defaultWindow: DEFAULT_WINDOW,
  });
};

export const clientErrorsQueryHandler = async (req: Request, res: Response) => {
  const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
  const endTimeMs = Date.now();
  const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;
  const logGroupName = logGroupFor('clientError');

  try {
    // Client errors are stored as JSON lines, so `message` and `kind` are queryable fields.
    const [rawMessages, kinds] = await Promise.all([
      runInsightsQuery({
        logGroupName,
        queryString: 'stats count(*) as count by message | sort count desc | limit 10000',
        startTimeMs,
        endTimeMs,
        limit: 10000,
      }),
      runInsightsQuery({
        logGroupName,
        queryString: 'stats count(*) as count by kind | sort count desc',
        startTimeMs,
        endTimeMs,
        limit: 50,
      }),
    ]);

    const bySignature = new Map<string, { signature: string; count: number; sample: string }>();
    for (const row of rawMessages) {
      const message = row.message ?? '';
      const count = Number(row.count) || 0;
      const { signature, readable } = summarizeError(message);
      const existing = bySignature.get(signature);
      if (existing) {
        existing.count += count;
      } else {
        bySignature.set(signature, { signature, count, sample: readable });
      }
    }

    const rows = Array.from(bySignature.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_ROWS);

    const byKind = kinds.map((k) => ({ kind: k.kind || '(none)', count: Number(k.count) || 0 }));

    return res.status(200).send({ success: 'true', rows, byKind, windowMinutes });
  } catch (err) {
    if (isMissingLogGroup(err)) {
      // The client-error log group is created lazily on first flush — none reported yet.
      return res.status(200).send({ success: 'true', rows: [], byKind: [], windowMinutes, notReady: true });
    }
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const clientErrorsTimeseriesHandler = async (req: Request, res: Response) => {
  const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
  const binInterval = binIntervalFor(windowMinutes);
  const endTimeMs = Date.now();
  const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;
  const logGroupName = logGroupFor('clientError');

  try {
    const [points, byKind] = await Promise.all([
      runTimeSeries({
        logGroupName,
        statsAndFilter: 'stats count(*) as errors',
        binInterval,
        startTimeMs,
        endTimeMs,
      }),
      runCategoryTimeSeries({
        logGroupName,
        statsAndFilter: 'filter ispresent(kind) | stats count(*) as errors',
        categoryField: 'kind',
        binInterval,
        startTimeMs,
        endTimeMs,
      }),
    ]);

    return res.status(200).send({ success: 'true', points, byKind, windowMinutes });
  } catch (err) {
    if (isMissingLogGroup(err)) {
      return res.status(200).send({ success: 'true', points: [], byKind: { times: [], series: {} }, windowMinutes });
    }
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), clientErrorsHandler],
  },
  {
    method: 'post',
    path: '/query',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), clientErrorsQueryHandler],
  },
  {
    method: 'post',
    path: '/timeseries',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), clientErrorsTimeseriesHandler],
  },
];
