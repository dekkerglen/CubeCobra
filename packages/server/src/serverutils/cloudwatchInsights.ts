// Helper for running CloudWatch Logs Insights queries against the server's log groups.
// Unlike serverutils/cloudwatch.ts (which only writes logs via PutLogEvents), this reads
// aggregated data back for the admin Errors/Performance dashboards.
//
// Requires the server IAM role to allow logs:StartQuery / logs:GetQueryResults /
// logs:StopQuery (added in the CDK stack). Insights is asynchronous — StartQuery returns a
// queryId that we then poll with GetQueryResults until the query completes.
import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  StartQueryCommand,
  StopQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

import 'dotenv/config';

const client = new CloudWatchLogsClient({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: fromNodeProviderChain(),
});

export type InsightsRow = Record<string, string>;

/**
 * Resolves the full log group name for the current environment. Server info/error logs
 * live under AWS_LOG_GROUP (e.g. `/cubecobra/production/server`) + `/info` or `/error`;
 * browser-reported client errors have their own group (AWS_CLIENT_ERROR_LOG_GROUP,
 * e.g. `/cubecobra/production/client/error`).
 */
export const logGroupFor = (kind: 'info' | 'error' | 'clientError'): string => {
  if (kind === 'clientError') {
    const clientGroup = process.env.AWS_CLIENT_ERROR_LOG_GROUP;
    if (!clientGroup) {
      throw new Error('AWS_CLIENT_ERROR_LOG_GROUP is not set — cannot resolve the client error log group');
    }
    return clientGroup;
  }

  const base = process.env.AWS_LOG_GROUP;
  if (!base) {
    throw new Error('AWS_LOG_GROUP is not set — cannot resolve the CloudWatch log group');
  }
  return `${base}/${kind}`;
};

/**
 * Picks a bin() interval that yields a readable number of points (~30-60) for the window.
 */
export const binIntervalFor = (windowMinutes: number): string => {
  if (windowMinutes <= 60) return '1m';
  if (windowMinutes <= 180) return '5m';
  if (windowMinutes <= 720) return '15m';
  if (windowMinutes <= 1440) return '30m';
  if (windowMinutes <= 4320) return '2h';
  return '6h';
};

// Insights returns bin timestamps as `YYYY-MM-DD HH:mm:ss.SSS` in UTC.
export const parseInsightsTime = (value: string): number => Date.parse(`${value.replace(' ', 'T')}Z`);

export interface TimeSeriesPoint {
  t: number;
  [metric: string]: number;
}

/**
 * Runs a time-bucketed Insights query. `statsAndFilter` is everything up to (but not
 * including) the `by bin(...)` clause, e.g. `filter ispresent(matchedPath) | stats
 * count(*) as hits, sum(responseSize) as egress`. Returns points sorted ascending by time,
 * with every non-time field coerced to a number.
 */
export const runTimeSeries = async ({
  logGroupName,
  statsAndFilter,
  binInterval,
  startTimeMs,
  endTimeMs,
}: {
  logGroupName: string;
  statsAndFilter: string;
  binInterval: string;
  startTimeMs: number;
  endTimeMs: number;
}): Promise<TimeSeriesPoint[]> => {
  const binKey = `bin(${binInterval})`;
  const rows = await runInsightsQuery({
    logGroupName,
    queryString: `${statsAndFilter} by bin(${binInterval})`,
    startTimeMs,
    endTimeMs,
    limit: 1000,
  });

  return rows
    .map((row) => {
      const point: TimeSeriesPoint = { t: parseInsightsTime(row[binKey] ?? '') };
      for (const [key, value] of Object.entries(row)) {
        if (key !== binKey) {
          point[key] = Number(value) || 0;
        }
      }
      return point;
    })
    .filter((point) => Number.isFinite(point.t))
    .sort((a, b) => a.t - b.t);
};

/**
 * Runs a two-dimensional (time × category) Insights query and pivots it into aligned
 * series for a stacked chart. `statsAndFilter` should end with a single count/sum metric,
 * e.g. `filter ispresent(status) | stats count(*) as hits`. `categoryField` is the second
 * grouping dimension (e.g. `status`). Returns aligned timestamps and one number[] per
 * category value.
 */
export const runCategoryTimeSeries = async ({
  logGroupName,
  statsAndFilter,
  categoryField,
  binInterval,
  startTimeMs,
  endTimeMs,
}: {
  logGroupName: string;
  statsAndFilter: string;
  categoryField: string;
  binInterval: string;
  startTimeMs: number;
  endTimeMs: number;
}): Promise<{ times: number[]; series: Record<string, number[]> }> => {
  const binKey = `bin(${binInterval})`;
  const rows = await runInsightsQuery({
    logGroupName,
    queryString: `${statsAndFilter} by bin(${binInterval}), ${categoryField}`,
    startTimeMs,
    endTimeMs,
    limit: 10000,
  });

  // Collect the metric alias (the one field that is neither the bin nor the category).
  const times = Array.from(
    new Set(rows.map((r) => parseInsightsTime(r[binKey] ?? '')).filter((t) => Number.isFinite(t))),
  ).sort((a, b) => a - b);
  const timeIndex = new Map(times.map((t, i) => [t, i]));

  const series: Record<string, number[]> = {};
  for (const row of rows) {
    const t = parseInsightsTime(row[binKey] ?? '');
    const idx = timeIndex.get(t);
    if (idx === undefined) continue;
    const category = row[categoryField] || '(none)';
    const metricKey = Object.keys(row).find((k) => k !== binKey && k !== categoryField);
    const value = metricKey ? Number(row[metricKey]) || 0 : 0;
    if (!series[category]) {
      series[category] = new Array(times.length).fill(0);
    }
    series[category][idx] = value;
  }

  return { times, series };
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface RunInsightsQueryArgs {
  logGroupName: string;
  queryString: string;
  // Window bounds in epoch milliseconds (converted to the seconds Insights expects).
  startTimeMs: number;
  endTimeMs: number;
  limit?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * Runs an Insights query and returns the result rows as plain objects keyed by field name
 * (the internal `@ptr` field is dropped). Blocks until the query completes, fails, or the
 * timeout elapses (in which case the query is stopped and an error is thrown).
 */
export const runInsightsQuery = async ({
  logGroupName,
  queryString,
  startTimeMs,
  endTimeMs,
  limit = 1000,
  timeoutMs = 30000,
  pollIntervalMs = 1000,
}: RunInsightsQueryArgs): Promise<InsightsRow[]> => {
  const start = await client.send(
    new StartQueryCommand({
      logGroupName,
      queryString,
      // Insights expects epoch seconds.
      startTime: Math.floor(startTimeMs / 1000),
      endTime: Math.floor(endTimeMs / 1000),
      limit,
    }),
  );

  const queryId = start.queryId;
  if (!queryId) {
    throw new Error('CloudWatch did not return a queryId');
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    const result = await client.send(new GetQueryResultsCommand({ queryId }));
    const status = result.status;

    if (status === 'Complete') {
      return (result.results || []).map((row) => {
        const obj: InsightsRow = {};
        for (const field of row) {
          if (field.field && field.field !== '@ptr' && field.value !== undefined) {
            obj[field.field] = field.value;
          }
        }
        return obj;
      });
    }

    if (status === 'Failed' || status === 'Cancelled' || status === 'Timeout') {
      throw new Error(`CloudWatch Insights query ${status}`);
    }
    // status is Scheduled or Running — keep polling.
  }

  // Timed out on our side — stop the query so it does not keep running server-side.
  try {
    await client.send(new StopQueryCommand({ queryId }));
  } catch {
    // best-effort stop; ignore
  }
  throw new Error(`CloudWatch Insights query timed out after ${timeoutMs}ms`);
};
