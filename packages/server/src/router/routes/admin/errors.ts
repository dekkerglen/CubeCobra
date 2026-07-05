import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { clampWindow, isMissingLogGroup, normalizeErrorMessage, parseErrorEntry } from 'serverutils/adminInsights';
import { binIntervalFor, logGroupFor, runInsightsQuery, runTimeSeries } from 'serverutils/cloudwatchInsights';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

// Re-exported so existing tests (test/admin/errors.test.ts) keep their import path.
export { normalizeErrorMessage };

const DEFAULT_WINDOW = 1440;
const MAX_ROWS = 200;

export const errorsHandler = async (req: Request, res: Response) => {
  return render(req, res, 'AdminErrorsPage', {
    defaultWindow: DEFAULT_WINDOW,
  });
};

export const errorsQueryHandler = async (req: Request, res: Response) => {
  try {
    const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;

    // Pre-aggregate exact-duplicate messages in Insights; we further merge near-duplicates
    // server-side via normalizeErrorMessage.
    const rawRows = await runInsightsQuery({
      logGroupName: logGroupFor('error'),
      queryString: 'stats count(*) as count by @message | sort count desc | limit 10000',
      startTimeMs,
      endTimeMs,
      limit: 10000,
    });

    interface ErrorGroup {
      signature: string;
      count: number;
      sample: string;
      errorType?: string;
      handler?: string;
      location?: string;
      method?: string;
      path?: string;
      authenticated?: boolean;
      unhandledRejection?: boolean;
      stack?: string;
    }

    const bySignature = new Map<string, ErrorGroup>();
    for (const row of rawRows) {
      const message = row['@message'] ?? '';
      const count = Number(row.count) || 0;
      const parsed = parseErrorEntry(message);
      const existing = bySignature.get(parsed.signature);
      if (existing) {
        existing.count += count;
      } else {
        // The first occurrence is the representative shown when the row is expanded.
        bySignature.set(parsed.signature, {
          signature: parsed.signature,
          count,
          sample: parsed.readable,
          errorType: parsed.errorType,
          handler: parsed.handler,
          location: parsed.location,
          method: parsed.method,
          path: parsed.path,
          authenticated: parsed.authenticated,
          unhandledRejection: parsed.unhandledRejection,
          stack: parsed.stack,
        });
      }
    }

    const rows = Array.from(bySignature.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_ROWS);

    return res.status(200).send({ success: 'true', rows, windowMinutes });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const errorsTimeseriesHandler = async (req: Request, res: Response) => {
  try {
    const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;

    const points = await runTimeSeries({
      logGroupName: logGroupFor('error'),
      statsAndFilter: 'stats count(*) as errors',
      binInterval: binIntervalFor(windowMinutes),
      startTimeMs,
      endTimeMs,
    });

    return res.status(200).send({ success: 'true', points, windowMinutes });
  } catch (err) {
    if (isMissingLogGroup(err)) {
      return res.status(200).send({ success: 'true', points: [], windowMinutes: clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW) });
    }
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), errorsHandler],
  },
  {
    method: 'post',
    path: '/query',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), errorsQueryHandler],
  },
  {
    method: 'post',
    path: '/timeseries',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), errorsTimeseriesHandler],
  },
];
