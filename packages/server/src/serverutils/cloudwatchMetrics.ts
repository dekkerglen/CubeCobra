// Helper for reading CloudWatch *metrics* (as opposed to serverutils/cloudwatchInsights.ts,
// which reads log data). Used by the admin Deckbuild dashboard to pull SQS queue depth and
// Lambda success/error/duration metrics via GetMetricData.
//
// Requires the server IAM role to allow cloudwatch:GetMetricData (added in the CDK stack).
import { CloudWatchClient, GetMetricDataCommand, MetricDataQuery } from '@aws-sdk/client-cloudwatch';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

import 'dotenv/config';

const client = new CloudWatchClient({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: fromNodeProviderChain(),
});

export interface MetricSpec {
  // A short id used as the result key. Must start with a lowercase letter (CloudWatch rule).
  id: string;
  namespace: string;
  metricName: string;
  dimensions: { Name: string; Value: string }[];
  stat: 'Sum' | 'Average' | 'Maximum' | 'Minimum' | 'SampleCount';
}

export interface MetricSeries {
  // Aligned ascending timestamps (epoch ms) and one value per timestamp (0 where CloudWatch
  // reported no datapoint for that bucket).
  times: number[];
  series: Record<string, number[]>;
}

/**
 * Picks a GetMetricData period (seconds, multiple of 60) that yields a readable number of
 * points for the window. Mirrors cloudwatchInsights.binIntervalFor.
 */
export const periodFor = (windowMinutes: number): number => {
  if (windowMinutes <= 60) return 60; // 1m
  if (windowMinutes <= 180) return 300; // 5m
  if (windowMinutes <= 720) return 900; // 15m
  if (windowMinutes <= 1440) return 1800; // 30m
  if (windowMinutes <= 4320) return 7200; // 2h
  return 21600; // 6h
};

/**
 * Fetches several metrics in one GetMetricData call and pivots them onto a single shared,
 * ascending time axis. Each spec's `id` becomes a key in `series`; buckets CloudWatch didn't
 * report a value for are filled with 0.
 */
export const getMetricData = async ({
  specs,
  startTimeMs,
  endTimeMs,
  periodSeconds,
}: {
  specs: MetricSpec[];
  startTimeMs: number;
  endTimeMs: number;
  periodSeconds: number;
}): Promise<MetricSeries> => {
  const queries: MetricDataQuery[] = specs.map((spec) => ({
    Id: spec.id,
    MetricStat: {
      Metric: {
        Namespace: spec.namespace,
        MetricName: spec.metricName,
        Dimensions: spec.dimensions,
      },
      Period: periodSeconds,
      Stat: spec.stat,
    },
    ReturnData: true,
  }));

  const result = await client.send(
    new GetMetricDataCommand({
      MetricDataQueries: queries,
      StartTime: new Date(startTimeMs),
      EndTime: new Date(endTimeMs),
      ScanBy: 'TimestampAscending',
    }),
  );

  const perId = new Map<string, { t: number; v: number }[]>();
  const allTimes = new Set<number>();
  for (const r of result.MetricDataResults || []) {
    const id = r.Id || '';
    const times = r.Timestamps || [];
    const values = r.Values || [];
    const points: { t: number; v: number }[] = [];
    for (let i = 0; i < times.length; i += 1) {
      const t = times[i] instanceof Date ? (times[i] as Date).getTime() : new Date(times[i] as any).getTime();
      if (!Number.isFinite(t)) continue;
      points.push({ t, v: Number(values[i]) || 0 });
      allTimes.add(t);
    }
    perId.set(id, points);
  }

  const timesSorted = Array.from(allTimes).sort((a, b) => a - b);
  const timeIndex = new Map(timesSorted.map((t, i) => [t, i]));

  const series: Record<string, number[]> = {};
  for (const spec of specs) {
    const filled = new Array(timesSorted.length).fill(0);
    for (const point of perId.get(spec.id) || []) {
      const idx = timeIndex.get(point.t);
      if (idx !== undefined) filled[idx] = point.v;
    }
    series[spec.id] = filled;
  }

  return { times: timesSorted, series };
};
