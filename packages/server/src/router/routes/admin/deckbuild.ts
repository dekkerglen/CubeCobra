import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { clampWindow } from 'serverutils/adminInsights';
import { getMetricData, MetricSpec, periodFor } from 'serverutils/cloudwatchMetrics';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

const DEFAULT_WINDOW = 180;

const queueName = () => process.env.BOT_DECKBUILD_QUEUE_NAME;
const dlqName = () => process.env.BOT_DECKBUILD_DLQ_NAME;
const functionName = () => process.env.BOT_DECKBUILD_FUNCTION_NAME;

// Builds the GetMetricData specs for the bot-deckbuild pipeline. SQS gauge metrics
// (queue depth, oldest-message age) use Maximum so a spike inside a bucket is visible; the
// counters (sent/deleted, Lambda invocations/errors/throttles) use Sum.
const buildSpecs = (queue: string, dlq: string, fn: string): MetricSpec[] => {
  const sqsDim = (name: string) => [{ Name: 'QueueName', Value: name }];
  const fnDim = [{ Name: 'FunctionName', Value: fn }];
  return [
    { id: 'queueDepth', namespace: 'AWS/SQS', metricName: 'ApproximateNumberOfMessagesVisible', dimensions: sqsDim(queue), stat: 'Maximum' },
    { id: 'oldestAge', namespace: 'AWS/SQS', metricName: 'ApproximateAgeOfOldestMessage', dimensions: sqsDim(queue), stat: 'Maximum' },
    { id: 'sent', namespace: 'AWS/SQS', metricName: 'NumberOfMessagesSent', dimensions: sqsDim(queue), stat: 'Sum' },
    { id: 'deleted', namespace: 'AWS/SQS', metricName: 'NumberOfMessagesDeleted', dimensions: sqsDim(queue), stat: 'Sum' },
    { id: 'dlqDepth', namespace: 'AWS/SQS', metricName: 'ApproximateNumberOfMessagesVisible', dimensions: sqsDim(dlq), stat: 'Maximum' },
    { id: 'invocations', namespace: 'AWS/Lambda', metricName: 'Invocations', dimensions: fnDim, stat: 'Sum' },
    { id: 'errors', namespace: 'AWS/Lambda', metricName: 'Errors', dimensions: fnDim, stat: 'Sum' },
    { id: 'throttles', namespace: 'AWS/Lambda', metricName: 'Throttles', dimensions: fnDim, stat: 'Sum' },
    { id: 'durationAvg', namespace: 'AWS/Lambda', metricName: 'Duration', dimensions: fnDim, stat: 'Average' },
    { id: 'durationMax', namespace: 'AWS/Lambda', metricName: 'Duration', dimensions: fnDim, stat: 'Maximum' },
  ];
};

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
const last = (values: number[]): number => (values.length ? values[values.length - 1] : 0);
// Mean of the datapoints CloudWatch actually reported (buckets with no invocation are 0 and
// would drag a plain average down, so we ignore them).
const meanNonZero = (values: number[]): number => {
  const present = values.filter((v) => v > 0);
  return present.length ? sum(present) / present.length : 0;
};

export const deckbuildHandler = async (req: Request, res: Response) => {
  return render(req, res, 'AdminDeckbuildPage', {
    defaultWindow: DEFAULT_WINDOW,
    configured: !!(queueName() && dlqName() && functionName()),
  });
};

export const deckbuildMetricsHandler = async (req: Request, res: Response) => {
  try {
    const queue = queueName();
    const dlq = dlqName();
    const fn = functionName();
    if (!queue || !dlq || !fn) {
      // Local dev / environments without the pipeline provisioned.
      return res.status(200).send({ success: 'true', configured: false });
    }

    const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
    const periodSeconds = periodFor(windowMinutes);
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;

    const { times, series } = await getMetricData({
      specs: buildSpecs(queue, dlq, fn),
      startTimeMs,
      endTimeMs,
      periodSeconds,
    });

    const invocations = sum(series.invocations || []);
    const errors = sum(series.errors || []);
    const throttles = sum(series.throttles || []);

    const summary = {
      invocations,
      errors,
      throttles,
      // null when there were no invocations in the window (rate is undefined, not 100%).
      successRate: invocations > 0 ? (invocations - errors) / invocations : null,
      enqueued: sum(series.sent || []),
      processed: sum(series.deleted || []),
      // "current" gauges: the most recent bucket in the window.
      backlog: Math.round(last(series.queueDepth || [])),
      oldestAgeSeconds: Math.round(last(series.oldestAge || [])),
      dlqDepth: Math.round(last(series.dlqDepth || [])),
      avgDurationMs: Math.round(meanNonZero(series.durationAvg || [])),
      maxDurationMs: Math.round(Math.max(0, ...(series.durationMax || [0]))),
    };

    return res.status(200).send({ success: 'true', configured: true, times, series, summary, windowMinutes });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), deckbuildHandler],
  },
  {
    method: 'post',
    path: '/metrics',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), deckbuildMetricsHandler],
  },
];
