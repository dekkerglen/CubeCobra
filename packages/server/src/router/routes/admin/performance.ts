import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { clampWindow } from 'serverutils/adminInsights';
import {
  binIntervalFor,
  logGroupFor,
  runCategoryTimeSeries,
  runInsightsQuery,
  runTimeSeries,
} from 'serverutils/cloudwatchInsights';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

const DEFAULT_WINDOW = 180;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// The metrics the Performance page can rank routes by. Each builds an Insights `stats ...`
// query grouped by matchedPath (the route pattern, so /cube/list/:id groups together).
// `value` is the ranked column; extra columns give context.
type MetricKey = 'hits' | 'slowest_avg' | 'slowest_p95' | 'server_time' | 'egress';

interface MetricDef {
  label: string;
  unit: string;
  // Builds the query body after the shared `filter`. {limit} is interpolated by the caller.
  stats: string;
  // Extra numeric columns (besides `value`) to surface per row.
  extraColumns: string[];
  // Optional additional filter clause (e.g. drop rows without a content-length for egress).
  extraFilter?: string;
}

const METRICS: Record<MetricKey, MetricDef> = {
  hits: {
    label: 'Most hit routes',
    unit: 'requests',
    stats: 'stats count(*) as value by matchedPath',
    extraColumns: [],
  },
  slowest_avg: {
    label: 'Slowest routes (avg)',
    unit: 'ms avg',
    stats: 'stats avg(duration) as value, count(*) as hits, max(duration) as maxMs by matchedPath',
    extraColumns: ['hits', 'maxMs'],
  },
  slowest_p95: {
    label: 'Slowest routes (p95)',
    unit: 'ms p95',
    stats: 'stats pct(duration, 95) as value, count(*) as hits by matchedPath',
    extraColumns: ['hits'],
  },
  server_time: {
    label: 'Most server time (sum of duration)',
    unit: 'ms total',
    stats: 'stats sum(duration) as value, count(*) as hits by matchedPath',
    extraColumns: ['hits'],
  },
  egress: {
    label: 'Most egress (sum of response bytes)',
    unit: 'bytes total',
    stats: 'stats sum(responseSize) as value, count(*) as hits by matchedPath',
    extraColumns: ['hits'],
    extraFilter: 'responseSize > 0',
  },
};

export const performanceHandler = async (req: Request, res: Response) => {
  return render(req, res, 'AdminPerformancePage', {
    defaultWindow: DEFAULT_WINDOW,
    defaultMetric: 'hits',
    metrics: Object.entries(METRICS).map(([key, def]) => ({ key, label: def.label, unit: def.unit })),
  });
};

export const performanceQueryHandler = async (req: Request, res: Response) => {
  try {
    const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);

    const metricKey = (req.body?.metric as MetricKey) in METRICS ? (req.body.metric as MetricKey) : 'hits';
    const metric = METRICS[metricKey];

    const requestedLimit = Number(req.body?.limit);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(1, requestedLimit), MAX_LIMIT) : DEFAULT_LIMIT;

    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;

    // Only aggregate rows that actually matched a route; unmatched requests have no
    // matchedPath and would collapse into a single meaningless bucket.
    const filters = ['filter ispresent(matchedPath)'];
    if (metric.extraFilter) {
      filters.push(`filter ${metric.extraFilter}`);
    }

    const queryString = `${filters.join(' | ')} | ${metric.stats} | sort value desc | limit ${limit}`;

    const rawRows = await runInsightsQuery({
      logGroupName: logGroupFor('info'),
      queryString,
      startTimeMs,
      endTimeMs,
      limit,
    });

    const rows = rawRows.map((row) => {
      const extras: Record<string, number> = {};
      for (const col of metric.extraColumns) {
        extras[col] = Number(row[col]) || 0;
      }
      return {
        matchedPath: row.matchedPath || '(unmatched)',
        value: Number(row.value) || 0,
        ...extras,
      };
    });

    return res.status(200).send({
      success: 'true',
      rows,
      windowMinutes,
      metric: metricKey,
      unit: metric.unit,
      extraColumns: metric.extraColumns,
    });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const performanceTimeseriesHandler = async (req: Request, res: Response) => {
  try {
    const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
    const binInterval = binIntervalFor(windowMinutes);
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;
    const logGroupName = logGroupFor('info');

    // Overall hits + egress over time, and hits broken down by status code over time.
    const [traffic, byStatus] = await Promise.all([
      runTimeSeries({
        logGroupName,
        statsAndFilter: 'stats count(*) as hits, sum(responseSize) as egress',
        binInterval,
        startTimeMs,
        endTimeMs,
      }),
      runCategoryTimeSeries({
        logGroupName,
        statsAndFilter: 'filter ispresent(status) | stats count(*) as hits',
        categoryField: 'status',
        binInterval,
        startTimeMs,
        endTimeMs,
      }),
    ]);

    return res.status(200).send({ success: 'true', traffic, byStatus, windowMinutes });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), performanceHandler],
  },
  {
    method: 'post',
    path: '/query',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), performanceQueryHandler],
  },
  {
    method: 'post',
    path: '/timeseries',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), performanceTimeseriesHandler],
  },
];
