import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { clampWindow, isMissingLogGroup, summarizeError } from 'serverutils/adminInsights';
import {
  binIntervalFor,
  logGroupFor,
  runCategoryTimeSeries,
  runInsightsQuery,
  runTimeSeries,
} from 'serverutils/cloudwatchInsights';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

const DEFAULT_WINDOW = 1440;
const MAX_ROWS = 200;

interface ClientErrorGroup {
  signature: string;
  count: number;
  sample: string;
  kind?: string;
  url?: string;
  source?: string;
  stack?: string;
  componentStack?: string;
  userAgent?: string;
  version?: string;
  username?: string | null;
  thirdParty: boolean;
}

// High-confidence markers that an error comes from a browser extension or injected
// third-party script rather than our app. These dominate raw client-error volume
// (reader mode, DarkReader, consent-management platforms, etc.) and are not actionable.
const THIRD_PARTY = /extension:\/\/|__firefox__|darkreader|__gpp\b|cmp timeout|Can't find variable: (?:__|DarkReader)/i;

const isLikelyThirdParty = (e: Record<string, string>): boolean =>
  THIRD_PARTY.test(`${e.message ?? ''} ${e.source ?? ''} ${e.stack ?? ''} ${e.url ?? ''}`);

const sourceLocation = (e: Record<string, string>): string | undefined => {
  if (!e.source) {
    return undefined;
  }
  const line = e.lineno ? `:${e.lineno}` : '';
  const col = e.colno ? `:${e.colno}` : '';
  return `${e.source}${line}${col}`;
};

export const clientErrorsHandler = async (req: Request, res: Response) => {
  return render(req, res, 'AdminClientErrorsPage', {
    defaultWindow: DEFAULT_WINDOW,
  });
};

export const clientErrorsQueryHandler = async (req: Request, res: Response) => {
  const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
  const endTimeMs = Date.now();
  const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;
  const logGroupName = logGroupFor('clientError');

  try {
    // Client errors are stored as JSON lines; pull the full record for each so we can
    // surface stack / url / source / browser / version / user, not just the message.
    const events = await runInsightsQuery({
      logGroupName,
      queryString:
        'fields message, kind, url, source, lineno, colno, stack, componentStack, userAgent, version, username ' +
        '| sort @timestamp desc | limit 10000',
      startTimeMs,
      endTimeMs,
      limit: 10000,
    });

    const bySignature = new Map<string, ClientErrorGroup>();
    const kindCounts = new Map<string, number>();
    for (const e of events) {
      const message = e.message ?? '';
      const { signature, readable } = summarizeError(message);
      kindCounts.set(e.kind || '(none)', (kindCounts.get(e.kind || '(none)') || 0) + 1);

      const existing = bySignature.get(signature);
      if (existing) {
        existing.count += 1;
      } else {
        // The most recent occurrence (events are sorted desc) is the representative shown.
        bySignature.set(signature, {
          signature,
          count: 1,
          sample: readable,
          kind: e.kind,
          url: e.url,
          source: sourceLocation(e),
          stack: e.stack,
          componentStack: e.componentStack,
          userAgent: e.userAgent,
          version: e.version,
          username: e.username ?? null,
          thirdParty: isLikelyThirdParty(e),
        });
      }
    }

    const rows = Array.from(bySignature.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_ROWS);

    const byKind = Array.from(kindCounts.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count);

    return res.status(200).send({ success: 'true', rows, byKind, windowMinutes });
  } catch (err) {
    if (isMissingLogGroup(err)) {
      // The client-error log group is created lazily on first flush — none reported yet.
      return res.status(200).send({ success: 'true', rows: [], byKind: [], windowMinutes, notReady: true });
    }
    req.logger.error(err);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const clientErrorsTimeseriesHandler = async (req: Request, res: Response) => {
  const windowMinutes = clampWindow(req.body?.windowMinutes, DEFAULT_WINDOW);
  const binInterval = binIntervalFor(windowMinutes);
  const endTimeMs = Date.now();
  const startTimeMs = endTimeMs - windowMinutes * 60 * 1000;
  const logGroupName = logGroupFor('clientError');

  try {
    const [points, byKind] = await Promise.all([
      runTimeSeries({
        logGroupName,
        statsAndFilter: 'stats count(*) as errors',
        binInterval,
        startTimeMs,
        endTimeMs,
      }),
      runCategoryTimeSeries({
        logGroupName,
        statsAndFilter: 'filter ispresent(kind) | stats count(*) as errors',
        categoryField: 'kind',
        binInterval,
        startTimeMs,
        endTimeMs,
      }),
    ]);

    return res.status(200).send({ success: 'true', points, byKind, windowMinutes });
  } catch (err) {
    if (isMissingLogGroup(err)) {
      return res.status(200).send({ success: 'true', points: [], byKind: { times: [], series: {} }, windowMinutes });
    }
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({ success: 'false', error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), clientErrorsHandler],
  },
  {
    method: 'post',
    path: '/query',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), clientErrorsQueryHandler],
  },
  {
    method: 'post',
    path: '/timeseries',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), clientErrorsTimeseriesHandler],
  },
];
