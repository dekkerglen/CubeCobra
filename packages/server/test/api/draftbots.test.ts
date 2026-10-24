import express, { RequestHandler } from 'express';
import request from 'supertest';

jest.mock('serverutils/carddb', () => ({
  getOracleForMl: jest.fn((oracle: string) => oracle),
}));
jest.mock('serverutils/ml', () => ({
  draft: jest.fn(async () => []),
  batchDraft: jest.fn(async (inputs: unknown[]) => inputs.map(() => [])),
}));

const ORACLE = '00000000-0000-4000-8000-000000000000';

// Loads the routes fresh for each app, so every test starts with an empty rate-limit window.
const buildApp = () => {
  let predictRoutes: any[] = [];
  let batchRoutes: any[] = [];
  jest.isolateModules(() => {
    predictRoutes = require('../../src/router/routes/api/draftbots/predict').routes;
    batchRoutes = require('../../src/router/routes/api/draftbots/batchpredict').routes;
  });
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.post('/predict', ...(predictRoutes[0].handler as RequestHandler[]));
  app.post('/batchpredict', ...(batchRoutes[0].handler as RequestHandler[]));
  return app;
};

describe('draftbot prediction limits', () => {
  it('accepts a normal draft request', async () => {
    const app = buildApp();

    const single = await request(app)
      .post('/predict')
      .send({ pack: Array(15).fill(ORACLE), picks: Array(45).fill(ORACLE) });
    expect(single.status).toBe(200);

    const batch = await request(app)
      .post('/batchpredict')
      .send({ inputs: Array(8).fill({ pack: Array(15).fill(ORACLE), picks: Array(45).fill(ORACLE) }) });
    expect(batch.status).toBe(200);
  });

  it.each([
    ['pack', { pack: Array(201).fill(ORACLE), picks: [] }],
    ['picks', { pack: [ORACLE], picks: Array(501).fill(ORACLE) }],
  ])('rejects an oversized %s list', async (_field, body) => {
    const app = buildApp();

    expect((await request(app).post('/predict').send(body)).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/batchpredict')
          .send({ inputs: [body] })
      ).status,
    ).toBe(400);
  });

  it('rejects more than 20 batch inputs', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/batchpredict')
      .send({ inputs: Array(21).fill({ pack: [ORACLE], picks: [] }) });
    expect(res.status).toBe(400);
  });

  it('rate-limits each client', async () => {
    const app = buildApp();
    const body = { pack: [ORACLE], picks: [] };

    for (let i = 0; i < 120; i++) {
      expect((await request(app).post('/predict').send(body)).status).toBe(200);
    }
    const limited = await request(app).post('/predict').send(body);
    expect(limited.status).toBe(429);
    expect(limited.body.success).toBe('false');
  });
});
