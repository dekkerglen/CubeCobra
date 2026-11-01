import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import { ipKey } from 'serverutils/rateLimiters';

import { Request, Response } from '../../../types/express';

// Browsers post CSP violation reports here (see serverutils/csp.ts). They are logged so the
// report-only script policy can be tightened into an enforced one.
const reportParser = bodyParser.json({
  type: ['application/csp-report', 'application/reports+json', 'application/json'],
  limit: '16kb',
});

const truncate = (value: unknown): string | undefined => (typeof value === 'string' ? value.slice(0, 300) : undefined);

// The ad network trips the report-only policy on nearly every page view, so log a sample:
// enough to see which sources the policy would block, without flooding CloudWatch.
const sampleRate = (): number => {
  const rate = Number(process.env.CSP_REPORT_SAMPLE_RATE ?? '0.02');
  return Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 1) : 0.02;
};

export const cspReportHandler = (req: Request, res: Response) => {
  const report = (req.body && (req.body['csp-report'] ?? req.body)) || {};
  // The request logger records bodies; a full report is several KB of noise, so drop it.
  req.body = undefined;
  if (Math.random() < sampleRate()) {
    req.logger.info('CSP violation', {
      directive: truncate(report['violated-directive'] ?? report.effectiveDirective),
      blocked: truncate(report['blocked-uri'] ?? report.blockedURL),
      document: truncate(report['document-uri'] ?? report.documentURL),
      source: truncate(report['source-file'] ?? report.sourceFile),
    });
  }
  return res.status(204).end();
};

// Past the limit a report is dropped with the same 204. A 429 counts against the instance in
// Elastic Beanstalk's health checks (these reports are a third of all requests), and browsers
// don't retry reports anyway.
const reportLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: ipKey,
  handler: (_req, res) => {
    res.status(204).end();
  },
});

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [reportLimiter, reportParser, cspReportHandler],
  },
];
