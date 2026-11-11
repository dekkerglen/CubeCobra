import { PATH_ANALYSIS_GROUPINGS, PathAnalysisGroupKey } from '@utils/datatypes/AdminInsights';
import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirectToAdminTab } from 'serverutils/adminDashboard';
import { clampWindow } from 'serverutils/adminInsights';
import { binIntervalFor, logGroupFor, runInsightsQuery, runTimeSeries } from 'serverutils/cloudwatchInsights';
import { Request, Response } from 'types/express';

const DEFAULT_WINDOW = 180;
const BREAKDOWN_LIMIT = 100;

// Each grouping's key is the log field it aggregates by. Checked against the list so the client
// can never inject an arbitrary field into the Insights query.
const isGroupKey = (value: unknown): value is PathAnalysisGroupKey =>
  PATH_ANALYSIS_GROUPINGS.some((grouping) => grouping.key === value);

// The analyzed path is interpolated into the Insights query as an exact-match string;
// JSON.stringify quotes and escapes it so user input can't break out of the literal.
const pathFilter = (routePath: string): string => `filter matchedPath = ${JSON.stringify(routePath)}`;

const requestedPath = (req: Request): string => String(req.body?.path ?? '').trim();

export const pathAnalysisTimeseriesHandler = async (req: Request, res: Response) => {
  try {
    const routePath = requestedPath(req);
    if (!routePath) {
      return res.status(400).send({ success: 'false', error: 'path is required' });
    }

    const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;

    const traffic = await runTimeSeries({
      logGroupName: logGroupFor('info'),
      statsAndFilter: `${pathFilter(routePath)} | stats count(*) as hits`,
      binInterval: binIntervalFor(windowMinutes),
      startTimeMs,
      endTimeMs,
    });

    return res.status(200).send({ success: 'true', traffic, windowMinutes });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const pathAnalysisBreakdownHandler = async (req: Request, res: Response) => {
  try {
    const routePath = requestedPath(req);
    if (!routePath) {
      return res.status(400).send({ success: 'false', error: 'path is required' });
    }

    const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
    const groupKey: PathAnalysisGroupKey = isGroupKey(req.body?.groupBy) ? req.body.groupBy : 'username';

    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;

    const rawRows = await runInsightsQuery({
      logGroupName: logGroupFor('info'),
      queryString:
        `${pathFilter(routePath)} | stats count(*) as hits, avg(duration) as avgMs, max(duration) as maxMs, ` +
        `sum(responseSize) as egress by ${groupKey} | sort hits desc | limit ${BREAKDOWN_LIMIT}`,
      startTimeMs,
      endTimeMs,
      limit: BREAKDOWN_LIMIT,
    });

    const rows = rawRows.map((row) => ({
      key: row[groupKey] || '(none)',
      hits: Number(row.hits) || 0,
      avgMs: Number(row.avgMs) || 0,
      maxMs: Number(row.maxMs) || 0,
      egress: Number(row.egress) || 0,
    }));

    return res.status(200).send({ success: 'true', rows, groupBy: groupKey, windowMinutes });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), redirectToAdminTab('pathanalysis')],
  },
  {
    method: 'post',
    path: '/timeseries',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), pathAnalysisTimeseriesHandler],
  },
  {
    method: 'post',
    path: '/breakdown',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), pathAnalysisBreakdownHandler],
  },
];
