import express, { RequestHandler } from 'express';
import request from 'supertest';

import { cspReportHandler } from '../../src/router/routes/api/cspreport';

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
};

const report = {
  'csp-report': {
    'violated-directive': 'script-src',
    'blocked-uri': 'eval',
    'document-uri': 'https://cubecobra.com/landing',
    'source-file': 'https://ads.example/ad.js',
  },
};

describe('cspReportHandler', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('logs a compact summary when sampled and clears the body from the request log', () => {
    process.env = { ...OLD_ENV, CSP_REPORT_SAMPLE_RATE: '1' };
    const req: any = { body: structuredClone(report), logger: { info: jest.fn() } };
    const res = makeRes();

    cspReportHandler(req, res);

    expect(req.logger.info).toHaveBeenCalledWith('CSP violation', {
      directive: 'script-src',
      blocked: 'eval',
      document: 'https://cubecobra.com/landing',
      source: 'https://ads.example/ad.js',
    });
    expect(req.body).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('does not log when sampling is off', () => {
    process.env = { ...OLD_ENV, CSP_REPORT_SAMPLE_RATE: '0' };
    const req: any = { body: structuredClone(report), logger: { info: jest.fn() } };

    cspReportHandler(req, makeRes());

    expect(req.logger.info).not.toHaveBeenCalled();
  });
});

describe('CSP report route', () => {
  // Loads the route fresh, so the test starts with an empty rate-limit window.
  const buildApp = () => {
    let routes: any[] = [];
    jest.isolateModules(() => {
      routes = require('../../src/router/routes/api/cspreport').routes;
    });
    const app = express();
    app.use((req: any, _res, next) => {
      req.logger = { info: jest.fn() };
      next();
    });
    app.post('/api/cspreport', ...(routes[0].handler as RequestHandler[]));
    return app;
  };

  it('answers 204 past the rate limit instead of 429', async () => {
    const app = buildApp();

    for (let i = 0; i < 11; i += 1) {
      const res = await request(app)
        .post('/api/cspreport')
        .set('Content-Type', 'application/csp-report')
        .send(JSON.stringify(report));
      expect(res.status).toBe(204);
    }
  });
});
