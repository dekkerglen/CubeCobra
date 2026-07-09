import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { clampWindow } from 'serverutils/adminInsights';
import { binIntervalFor, logGroupFor, runInsightsQuery, runTimeSeries } from 'serverutils/cloudwatchInsights';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

const DEFAULT_WINDOW = 180;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// The metrics the Payloads page can rank routes by. Each builds an Insights `stats ...`
// query grouped by matchedPath (the route pattern, so /cube/list/:id groups together).
// `value` is the ranked column; extra columns give context. requestSize is the bytes read
// off the socket for the request; responseSize is the response content-length.
type MetricKey = 'ingress_total' | 'ingress_avg' | 'egress_total' | 'egress_avg';

interface MetricDef {
  label: string;
  unit: string;
  // Builds the query body after the shared `filter`.
  stats: string;
  // Extra numeric columns (besides `value`) to surface per row.
  extraColumns: string[];
  // Additional filter clause so rows without a usable size don't skew the aggregation.
  extraFilter: string;
}

const METRICS: Record<MetricKey, MetricDef> = {
  ingress_total: {
    label: 'Most ingress (sum of request bytes)',
    unit: 'bytes total',
    stats: 'stats sum(requestSize) as value, count(*) as hits, avg(requestSize) as avgBytes by matchedPath',
    extraColumns: ['hits', 'avgBytes'],
    extraFilter: 'requestSize > 0',
  },
  ingress_avg: {
    label: 'Largest requests (avg request bytes)',
    unit: 'bytes avg',
    stats: 'stats avg(requestSize) as value, count(*) as hits, max(requestSize) as maxBytes by matchedPath',
    extraColumns: ['hits', 'maxBytes'],
    extraFilter: 'requestSize > 0',
  },
  egress_total: {
    label: 'Most egress (sum of response bytes)',
    unit: 'bytes total',
    stats: 'stats sum(responseSize) as value, count(*) as hits, avg(responseSize) as avgBytes by matchedPath',
    extraColumns: ['hits', 'avgBytes'],
    extraFilter: 'responseSize > 0',
  },
  egress_avg: {
    label: 'Largest responses (avg response bytes)',
    unit: 'bytes avg',
    stats: 'stats avg(responseSize) as value, count(*) as hits, max(responseSize) as maxBytes by matchedPath',
    extraColumns: ['hits', 'maxBytes'],
    extraFilter: 'responseSize > 0',
  },
};

// Size buckets are order-of-magnitude in bytes. floor(log10(size)) gives a magnitude the
// client turns into a human range (e.g. magnitude 3 -> 1 KB–10 KB).
const distributionQuery = (field: string): string =>
  `filter ispresent(${field}) and ${field} > 0 | fields floor(log(${field}) / log(10)) as magnitude ` +
  `| stats count(*) as hits, sum(${field}) as bytes by magnitude | sort magnitude asc`;

interface DistBucket {
  magnitude: number;
  hits: number;
  bytes: number;
}

const runDistribution = async (field: string, startTimeMs: number, endTimeMs: number): Promise<DistBucket[]> => {
  const rows = await runInsightsQuery({
    logGroupName: logGroupFor('info'),
    queryString: distributionQuery(field),
    startTimeMs,
    endTimeMs,
    limit: 100,
  });
  return rows
    .map((row) => ({
      magnitude: Number(row.magnitude) || 0,
      hits: Number(row.hits) || 0,
      bytes: Number(row.bytes) || 0,
    }))
    .sort((a, b) => a.magnitude - b.magnitude);
};

export const payloadsHandler = async (req: Request, res: Response) => {
  return render(req, res, 'AdminPayloadsPage', {
    defaultWindow: DEFAULT_WINDOW,
    defaultMetric: 'ingress_total',
    metrics: Object.entries(METRICS).map(([key, def]) => ({ key, label: def.label, unit: def.unit })),
  });
};

export const payloadsQueryHandler = async (req: Request, res: Response) => {
  try {
    const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);

    const metricKey = (req.body?.metric as MetricKey) in METRICS ? (req.body.metric as MetricKey) : 'ingress_total';
    const metric = METRICS[metricKey];

    const requestedLimit = Number(req.body?.limit);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(1, requestedLimit), MAX_LIMIT) : DEFAULT_LIMIT;

    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;

    // Only aggregate rows that actually matched a route; unmatched requests have no
    // matchedPath and would collapse into a single meaningless bucket.
    const filters = ['filter ispresent(matchedPath)', `filter ${metric.extraFilter}`];
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

export const payloadsChartsHandler = async (req: Request, res: Response) => {
  try {
    const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
    const binInterval = binIntervalFor(windowMinutes);
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;
    const logGroupName = logGroupFor('info');

    // Total bytes in/out over time, plus a size distribution of requests and responses.
    const [traffic, ingressDist, egressDist] = await Promise.all([
      runTimeSeries({
        logGroupName,
        statsAndFilter: 'stats sum(requestSize) as ingress, sum(responseSize) as egress, count(*) as hits',
        binInterval,
        startTimeMs,
        endTimeMs,
      }),
      runDistribution('requestSize', startTimeMs, endTimeMs),
      runDistribution('responseSize', startTimeMs, endTimeMs),
    ]);

    return res.status(200).send({ success: 'true', traffic, ingressDist, egressDist, windowMinutes });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), payloadsHandler],
  },
  {
    method: 'post',
    path: '/query',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), payloadsQueryHandler],
  },
  {
    method: 'post',
    path: '/charts',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), payloadsChartsHandler],
  },
];
