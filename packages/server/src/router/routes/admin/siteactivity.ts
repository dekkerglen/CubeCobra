import {
  ACTIVE_USER_PERIOD_COUNTERS,
  SITE_ACTIVITY_MAX_PERIODS,
  SITE_ACTIVITY_METRICS,
  SiteActivityBucket,
  SiteActivityCounter,
  SiteActivityGranularity,
  SiteActivityMetric,
} from '@utils/datatypes/SiteActivity';
import { UserRoles } from '@utils/datatypes/User';
import { siteActivityDao } from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation, csrfProtection, ensureRole } from 'router/middleware';
import { redirectToAdminTab } from 'serverutils/adminDashboard';
import { periodStart, utcDay } from 'serverutils/siteActivity';

import { Request, Response } from '../../../types/express';

const DAY_MS = 24 * 60 * 60 * 1000;

const SiteActivityStatsSchema = Joi.object({
  granularity: Joi.string()
    .valid(...Object.keys(SITE_ACTIVITY_MAX_PERIODS))
    .required(),
  periods: Joi.number().integer().min(1).required(),
});

/** Start of the period `back` periods before the one starting at `start`. */
const shiftPeriods = (start: number, granularity: SiteActivityGranularity, back: number): number => {
  const d = new Date(start);
  switch (granularity) {
    case 'week':
      return start - back * 7 * DAY_MS;
    case 'month':
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1);
    case 'year':
      return Date.UTC(d.getUTCFullYear() - back, 0, 1);
    default:
      return start - back * DAY_MS;
  }
};

/**
 * The stored counter a metric's period total is summed from. Every metric sums its own daily
 * counts, except active users: a week's distinct active users is the sum of each day's users who
 * were active for the first time that week.
 */
const sourceCounter = (metric: SiteActivityMetric, granularity: SiteActivityGranularity): SiteActivityCounter =>
  metric === 'activeUsers' && granularity !== 'day' ? ACTIVE_USER_PERIOD_COUNTERS[granularity] : metric;

const emptyBucket = (start: string): SiteActivityBucket => {
  const bucket = { start } as SiteActivityBucket;
  for (const metric of SITE_ACTIVITY_METRICS) {
    bucket[metric] = 0;
  }
  return bucket;
};

/** The last `periods` UTC periods, the current unfinished one included. */
export const siteActivityStatsHandler = async (req: Request, res: Response) => {
  try {
    const { granularity, periods } = req.body as { granularity: SiteActivityGranularity; periods: number };
    if (periods > SITE_ACTIVITY_MAX_PERIODS[granularity]) {
      return res
        .status(400)
        .send({ success: 'false', error: `Range is capped at ${SITE_ACTIVITY_MAX_PERIODS[granularity]} periods.` });
    }

    const now = Date.now();
    const current = periodStart(now, granularity);
    const starts: string[] = [];
    for (let back = periods - 1; back >= 0; back -= 1) {
      starts.push(utcDay(shiftPeriods(current, granularity, back)));
    }

    const buckets = new Map(starts.map((start) => [start, emptyBucket(start)]));
    for (const day of await siteActivityDao.getRange(starts[0]!, utcDay(now))) {
      const bucket = buckets.get(utcDay(periodStart(Date.parse(`${day.date}T00:00:00Z`), granularity)));
      if (!bucket) continue;
      for (const metric of SITE_ACTIVITY_METRICS) {
        bucket[metric] += day[sourceCounter(metric, granularity)];
      }
    }

    return res.status(200).send({ success: 'true', buckets: [...buckets.values()] });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({ success: 'false', error: error.message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), redirectToAdminTab('siteactivity')],
  },
  {
    method: 'post',
    path: '/stats',
    handler: [
      csrfProtection,
      ensureRole(UserRoles.ADMIN),
      bodyValidation(SiteActivityStatsSchema),
      siteActivityStatsHandler,
    ],
  },
];
