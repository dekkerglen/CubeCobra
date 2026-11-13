// Daily site activity counters for the admin Site Activity dashboard (see
// dynamo/dao/SiteActivityDynamoDao.ts). Fire-and-forget: callers do not await, and a failed
// count can never affect the request.
import {
  ACTIVE_USER_PERIOD_COUNTERS,
  SiteActivityGranularity,
  SiteActivityMetric,
} from '@utils/datatypes/SiteActivity';
import { siteActivityDao } from 'dynamo/daos';

import { NextFunction, Request, Response } from '../types/express';
import cloudwatch from './cloudwatch';

type Logger = { error: (...args: any[]) => void };

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC day containing `ms`, as YYYY-MM-DD. */
export const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Start of the UTC period containing `ms`, as epoch ms. Weeks start on Monday. */
export const periodStart = (ms: number, granularity: SiteActivityGranularity): number => {
  const d = new Date(ms);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  switch (granularity) {
    case 'week':
      return day - ((d.getUTCDay() + 6) % 7) * DAY_MS;
    case 'month':
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    case 'year':
      return Date.UTC(d.getUTCFullYear(), 0, 1);
    default:
      return day;
  }
};

/** Counts `count` events. Without a request logger (shared helpers), failures go to cloudwatch. */
export function recordSiteActivity(metric: SiteActivityMetric, logger?: Logger, count: number = 1): void {
  if (count <= 0) {
    return;
  }
  // Started inside a promise so even a synchronous failure lands in the catch, not the caller.
  Promise.resolve()
    .then(() => siteActivityDao.increment({ [metric]: count }))
    .catch((err) => {
      (logger ?? cloudwatch).error('Failed to record site activity', metric, err);
    });
}

/**
 * Counts a user active today, once per UTC day. The first activity in a new week, month or
 * year also counts toward that period's distinct active users (see ACTIVE_USER_PERIOD_COUNTERS).
 */
export const recordActiveUser = async (userId: string): Promise<void> => {
  const now = Date.now();
  const today = utcDay(now);
  const previous = await siteActivityDao.markUserActive(userId, today);
  if (previous === undefined) {
    return;
  }

  const previousMs = previous === null ? null : Date.parse(`${previous}T00:00:00Z`);
  const isFirstOf = (granularity: SiteActivityGranularity) =>
    previousMs === null || periodStart(previousMs, granularity) < periodStart(now, granularity);

  await siteActivityDao.increment({
    activeUsers: 1,
    ...(isFirstOf('week') ? { [ACTIVE_USER_PERIOD_COUNTERS.week]: 1 } : {}),
    ...(isFirstOf('month') ? { [ACTIVE_USER_PERIOD_COUNTERS.month]: 1 } : {}),
    ...(isFirstOf('year') ? { [ACTIVE_USER_PERIOD_COUNTERS.year]: 1 } : {}),
  });
};

// Users this server has already sent to recordActiveUser today, so only a user's first request
// of the day touches Dynamo. Cleared when the UTC day changes, so it holds one day of users.
// Several servers each count a user once; markUserActive keeps that to one count overall.
let seenDay = '';
const seenToday = new Set<string>();

/** Middleware: counts the logged-in user toward today's active users. Never delays the request. */
export const trackActiveUsers = (req: Request, _res: Response, next: NextFunction): void => {
  const userId = req.user?.id;
  if (userId) {
    const today = utcDay(Date.now());
    if (today !== seenDay) {
      seenDay = today;
      seenToday.clear();
    }
    if (!seenToday.has(userId)) {
      seenToday.add(userId);
      recordActiveUser(userId).catch((err) => {
        req.logger.error('Failed to record active user', err);
      });
    }
  }
  next();
};
