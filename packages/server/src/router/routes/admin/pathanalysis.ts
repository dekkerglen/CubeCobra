import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { clampWindow } from 'serverutils/adminInsights';
import { binIntervalFor, logGroupFor, runInsightsQuery, runTimeSeries } from 'serverutils/cloudwatchInsights';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

const DEFAULT_WINDOW = 180;
const BREAKDOWN_LIMIT = 100;

// Dimensions the breakdown table can aggregate a route's requests by. Whitelisted so the
// client can never inject an arbitrary field into the Insights query.
type GroupKey = 'username' | 'remoteAddr' | 'status' | 'method' | 'path';

const GROUPINGS: Record<GroupKey, { label: string; field: string }> = {
  username: { label: 'User', field: 'username' },
  remoteAddr: { label: 'IP address', field: 'remoteAddr' },
  status: { label: 'Status code', field: 'status' },
  method: { label: 'Method', field: 'method' },
  path: { label: 'Exact URL', field: 'path' },
};

// The analyzed path is interpolated into the Insights query as an exact-match string;
// JSON.stringify quotes and escapes it so user input can't break out of the literal.
const pathFilter = (routePath: string): string => `filter matchedPath = ${JSON.stringify(routePath)}`;

const requestedPath = (req: Request): string => String(req.body?.path ?? '').trim();

export const pathAnalysisHandler = async (req: Request, res: Response) => {
  return render(req, res, 'AdminPathAnalysisPage', {
    defaultWindow: DEFAULT_WINDOW,
    initialPath: typeof req.query.path === 'string' ? req.query.path : '',
    groupings: Object.entries(GROUPINGS).map(([key, def]) => ({ key, label: def.label })),
  });
};

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
    const groupKey = (req.body?.groupBy as GroupKey) in GROUPINGS ? (req.body.groupBy as GroupKey) : 'username';
    const grouping = GROUPINGS[groupKey];

    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;

    const rawRows = await runInsightsQuery({
      logGroupName: logGroupFor('info'),
      queryString:
        `${pathFilter(routePath)} | stats count(*) as hits, avg(duration) as avgMs, max(duration) as maxMs, ` +
        `sum(responseSize) as egress by ${grouping.field} | sort hits desc | limit ${BREAKDOWN_LIMIT}`,
      startTimeMs,
      endTimeMs,
      limit: BREAKDOWN_LIMIT,
    });

    const rows = rawRows.map((row) => ({
      key: row[grouping.field] || '(none)',
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
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), pathAnalysisHandler],
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
