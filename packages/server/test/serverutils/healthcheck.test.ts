import express from 'express';
import session from 'express-session';
import request from 'supertest';

import { registerHealthcheck } from '../../src/serverutils/healthcheck';

// Mounted ahead of a session middleware, as in index.ts, to prove checks never create a session.
const buildApp = (isReady: () => boolean) => {
  const app = express();
  registerHealthcheck(app, isReady);
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: true }));
  app.use((_req, res) => {
    res.status(404).send('fell through');
  });
  return app;
};

describe('healthcheck', () => {
  it.each(['get', 'post'] as const)('answers %s with OK once the app is ready', async (method) => {
    const res = await request(buildApp(() => true))[method]('/healthcheck');

    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('answers HEAD without a body', async () => {
    const res = await request(buildApp(() => true)).head('/healthcheck');

    expect(res.status).toBe(200);
    expect(res.text).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('reports unavailable while the app is still starting', async () => {
    const res = await request(buildApp(() => false)).get('/healthcheck');

    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('reads readiness on every request', async () => {
    let ready = false;
    const app = buildApp(() => ready);

    expect((await request(app).get('/healthcheck')).status).toBe(503);
    ready = true;
    expect((await request(app).get('/healthcheck')).status).toBe(200);
  });
});
