import {
  DAILY_GAME_KEYS,
  DailyGameDayStats,
  DailyGameKey,
  DailyGamePageHits,
  DailyGameSeries,
} from '@utils/datatypes/DailyGameStats';
import { DailyP1P1 } from '@utils/datatypes/DailyP1P1';
import { UserRoles } from '@utils/datatypes/User';
import {
  crosswordSubmissionDao,
  dailyP1P1Dao,
  manaMatrixSubmissionDao,
  p1p1PackDao,
  synergyConnectSubmissionDao,
} from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation, csrfProtection, ensureRole } from 'router/middleware';
import { isMissingLogGroup } from 'serverutils/adminInsights';
import { logGroupFor, runTimeSeries } from 'serverutils/cloudwatchInsights';
import {
  datesBetween,
  emptyDay,
  summarizeCrosswordDay,
  summarizeDailyP1P1Day,
  summarizeManaMatrixDay,
  summarizeSynergyConnectDay,
} from 'serverutils/dailyGameFunnel';
import { handleRouteError, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

/**
 * How far back the range picker may reach.
 *
 * 30 days is not an arbitrary round number: the server's info log group is created with
 * RetentionDays.ONE_MONTH (see packages/cdk/lib/elastic-beanstalk.ts), so page hits older
 * than that do not exist to be queried. Allowing a wider range would silently drop the
 * top of the funnel for the older half of the chart.
 *
 * It also bounds the read cost. A range is one GSI2 query per game per day — see the cost
 * note on `submissionSeries` — and 30 days is where that stays comfortable.
 */
export const MAX_RANGE_DAYS = 30;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DailyGameStatsSchema = Joi.object({
  startDate: Joi.string().pattern(DATE_PATTERN).required(),
  endDate: Joi.string().pattern(DATE_PATTERN).required(),
});

const utcDay = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * The page route whose request-log hits stand in for "opened the game".
 *
 * Only the active-puzzle route, never the `/:date` archive route. The archive route's hits
 * are stamped with the day the visit happened while its submissions are filed under the
 * puzzle's date, so including it would put the two halves of the funnel on different axes.
 * These strings must match `req.route.path` as registered in router.ts, which is
 * `<directory>/<file><route.path>`.
 */
const PAGE_ROUTES: Record<DailyGameKey, string> = {
  manamatrix: '/tool/manamatrix/',
  synergyconnect: '/tool/synergyconnect/',
  crossword: '/tool/crossword/',
  dailyp1p1: '/tool/p1p1/daily',
};

const GAME_LABELS: Record<DailyGameKey, string> = {
  manamatrix: 'ManaMatrix',
  synergyconnect: 'Synergy Connect',
  crossword: 'Crossword',
  dailyp1p1: 'Daily P1P1',
};

const ANONYMOUS_NOTE =
  'Anonymous play is judged server-side but never persisted, so started / partial / finished count logged-in players only. Page hits count everyone.';

const NOTES: Record<DailyGameKey, string[]> = {
  manamatrix: [
    ANONYMOUS_NOTE,
    'A row is only created by the first submitted answer, so "started" here means attempted at least one cell — someone who opened the grid and typed nothing is not counted.',
    'Finished means all nine cells correct, merged across attempts.',
  ],
  synergyconnect: [
    ANONYMOUS_NOTE,
    'A row is only created by the first guess, so "started" means guessed at least once.',
    'Finished means all four groups found. Players who used up all four mistakes are inside "partial" and broken out as "locked out" — they are done, but they did not finish.',
  ],
  crossword: [
    ANONYMOUS_NOTE,
    'Alone among these games, the row is created when the puzzle is opened, because that is when the clock starts. So "started" means opened, and "engaged" is how many of those ever submitted, checked or revealed anything.',
    "Finished means solved. Median time is over the players who solved it, and is the game's own scoring metric.",
  ],
  dailyp1p1: [
    "A vote is one click, so there is no funnel to draw — the count is distinct voters on that day's pack.",
    'Votes are stored on the pack, not per day, and a pack keeps accepting votes after it stops being the daily one. Late votes are therefore attributed to the day the pack was daily.',
  ],
};

/**
 * Daily P1P1 voters per day.
 *
 * There is no per-user-per-day item for P1P1 — votes live in `votesByUser` on the pack — so
 * this walks the daily-P1P1 history (GSI1, one query) and reads each day's pack. `date` on
 * a DailyP1P1 is epoch ms, not a YYYY-MM-DD string, so it is bucketed into a UTC day here.
 */
const dailyP1P1Series = async (dates: string[]): Promise<DailyGameDayStats[]> => {
  if (dates.length === 0) {
    return [];
  }

  const wanted = new Set(dates);
  const packIdsByDate = new Map<string, string>();

  // Walk history newest-first until we are past the start of the range. One page per 50 days.
  let lastKey: Record<string, any> | undefined = undefined;
  const earliest = dates[0]!;
  let exhausted = false;
  for (let page = 0; page < 10 && !exhausted; page++) {
    const result: { items: DailyP1P1[]; lastKey?: Record<string, any> } = await dailyP1P1Dao.getDailyP1P1History(
      lastKey,
      50,
    );

    for (const daily of result.items) {
      const day = new Date(daily.date).toISOString().slice(0, 10);
      if (day < earliest) {
        exhausted = true;
        continue;
      }
      // Newest-first, so the first entry seen for a day is the one that ended it as daily.
      if (wanted.has(day) && !packIdsByDate.has(day)) {
        packIdsByDate.set(day, daily.packId);
      }
    }

    lastKey = result.lastKey;
    if (!lastKey) {
      exhausted = true;
    }
  }

  const voterIdsByDate = new Map<string, string[]>();
  await Promise.all(
    [...packIdsByDate.entries()].map(async ([day, packId]) => {
      const pack = await p1p1PackDao.getMetadataById(packId);
      voterIdsByDate.set(day, Object.keys(pack?.votesByUser ?? {}));
    }),
  );

  return dates.map((date) =>
    voterIdsByDate.has(date) ? summarizeDailyP1P1Day(date, voterIdsByDate.get(date)!) : emptyDay(date),
  );
};

/**
 * Per-day counts from the submission tables.
 *
 * Cost, stated plainly: one GSI2 query per game per day in the range, each reading that
 * day's players for that game. 30 days across the three funnel games is ~90 queries, each
 * over a partition holding one day of one game's players. That is bounded and admin-only,
 * and it is not a table scan. It is still the most expensive thing this page does, which is
 * why the range is capped and the result is cached briefly.
 *
 * Days are zero-filled so a quiet day plots as zero rather than vanishing.
 */
const submissionSeries = async (
  dates: string[],
): Promise<{
  manamatrix: DailyGameDayStats[];
  synergyconnect: DailyGameDayStats[];
  crossword: DailyGameDayStats[];
  dailyp1p1: DailyGameDayStats[];
}> => {
  const [manamatrix, synergyconnect, crossword, dailyp1p1] = await Promise.all([
    Promise.all(
      dates.map(async (date) => summarizeManaMatrixDay(date, await manaMatrixSubmissionDao.getAllByDate(date))),
    ),
    Promise.all(
      dates.map(async (date) => summarizeSynergyConnectDay(date, await synergyConnectSubmissionDao.getAllByDate(date))),
    ),
    Promise.all(
      dates.map(async (date) => summarizeCrosswordDay(date, await crosswordSubmissionDao.getAllByDate(date))),
    ),
    dailyP1P1Series(dates),
  ]);

  return { manamatrix, synergyconnect, crossword, dailyp1p1 };
};

/**
 * Per-UTC-day request counts on one game's page, from the server info log.
 *
 * `bin(1d)` bins on UTC midnight, which is the same boundary the puzzle dates use, so the
 * buckets line up with the submission series. `user_id` is null for anonymous requests and
 * Insights skips missing fields, so count_distinct gives logged-in uniques.
 *
 * Nothing here filters bots: the access log records no user agent (see the responseTime
 * middleware in router/router.ts), so crawler traffic is inside `hits` and cannot be
 * separated out. Treat `hits` as an upper bound on humans who opened the page.
 */
const pageHitSeries = async (
  routePath: string,
  dates: string[],
): Promise<{ hits: DailyGamePageHits[] | null; error?: string }> => {
  if (dates.length === 0) {
    return { hits: [] };
  }

  const startTimeMs = Date.parse(`${dates[0]}T00:00:00Z`);
  const endTimeMs = Date.parse(`${dates[dates.length - 1]}T00:00:00Z`) + 24 * 60 * 60 * 1000;

  try {
    const points = await runTimeSeries({
      logGroupName: logGroupFor('info'),
      // The route is interpolated as a JSON string literal so it cannot break out, matching
      // the pattern in admin/pathanalysis.ts.
      statsAndFilter:
        `filter matchedPath = ${JSON.stringify(routePath)} ` +
        `| stats count(*) as hits, count_distinct(user_id) as loggedInUsers`,
      binInterval: '1d',
      startTimeMs,
      endTimeMs,
    });

    const byDate = new Map<string, DailyGamePageHits>();
    for (const point of points) {
      const date = new Date(point.t).toISOString().slice(0, 10);
      byDate.set(date, { date, hits: point.hits ?? 0, loggedInUsers: point.loggedInUsers ?? 0 });
    }

    return { hits: dates.map((date) => byDate.get(date) ?? { date, hits: 0, loggedInUsers: 0 }) };
  } catch (err) {
    const error = err as Error;
    // A log group that does not exist yet, or no credentials at all in local dev, is not a
    // server error — the submission half of the dashboard is still worth showing.
    return {
      hits: null,
      error: isMissingLogGroup(err) ? 'The server info log group does not exist in this environment.' : error.message,
    };
  }
};

/**
 * Short-lived in-process cache. Each load runs ~90 Dynamo queries and four Insights queries,
 * and an admin comparing two games will reload the same range repeatedly; 60s is long enough
 * to make that free and short enough that today's numbers stay live.
 *
 * Bounded, because the key is a caller-chosen date range and there are more ranges than an
 * unbounded Map should hold. Expired entries are dropped on write, and if that is not enough
 * the oldest goes; a dashboard cache is not worth a real LRU.
 */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 64;
const cache = new Map<string, { at: number; series: DailyGameSeries[] }>();

const cacheStore = (key: string, series: DailyGameSeries[]): void => {
  const now = Date.now();
  for (const [existingKey, entry] of cache) {
    if (now - entry.at >= CACHE_TTL_MS) {
      cache.delete(existingKey);
    }
  }
  // Map iterates in insertion order, so the first key is the oldest write.
  while (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    cache.delete(oldest);
  }
  cache.set(key, { at: now, series });
};

export const dailyGamesPageHandler = async (req: Request, res: Response) => {
  try {
    return render(req, res, 'AdminDailyGamesPage', {
      defaultStartDate: utcDay(-13),
      defaultEndDate: utcDay(0),
      maxRangeDays: MAX_RANGE_DAYS,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/');
  }
};

export const dailyGamesStatsHandler = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body as { startDate: string; endDate: string };

    const dates = datesBetween(startDate, endDate);
    if (dates.length === 0) {
      return res.status(400).send({ success: 'false', error: 'endDate must not precede startDate' });
    }
    if (dates.length > MAX_RANGE_DAYS) {
      return res
        .status(400)
        .send({ success: 'false', error: `Range is capped at ${MAX_RANGE_DAYS} days (request-log retention).` });
    }

    const cacheKey = `${startDate}:${endDate}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return res.status(200).send({ success: 'true', startDate, endDate, series: cached.series });
    }

    const [days, pageHits] = await Promise.all([
      submissionSeries(dates),
      Promise.all(
        DAILY_GAME_KEYS.map(async (game) => ({
          game,
          ...(await pageHitSeries(PAGE_ROUTES[game], dates)),
        })),
      ),
    ]);

    const hitsByGame = new Map(pageHits.map((entry) => [entry.game, entry]));

    const series: DailyGameSeries[] = DAILY_GAME_KEYS.map((game) => {
      const hits = hitsByGame.get(game);
      return {
        game,
        label: GAME_LABELS[game],
        pageRoute: PAGE_ROUTES[game],
        days: days[game],
        pageHits: hits?.hits ?? null,
        ...(hits?.error ? { pageHitsError: hits.error } : {}),
        hasFunnel: game !== 'dailyp1p1',
        notes: NOTES[game],
      };
    });

    cacheStore(cacheKey, series);

    return res.status(200).send({ success: 'true', startDate, endDate, series });
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
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), dailyGamesPageHandler],
  },
  {
    method: 'post',
    path: '/stats',
    handler: [
      csrfProtection,
      ensureRole(UserRoles.ADMIN),
      bodyValidation(DailyGameStatsSchema),
      dailyGamesStatsHandler,
    ],
  },
];
