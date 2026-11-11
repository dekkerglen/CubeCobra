import express, { Application, Router } from 'express';
import { getPreferredPrinting } from 'serverutils/carddb';
import request from 'supertest';

import { routes as getprintingsRoutes } from '../../../src/router/routes/cube/api/getprintings';
import { createCardDetails } from '../../test-utils/data';

jest.mock('serverutils/carddb');

const OLD_ID = 'a3e1f8d2-4c5b-4e7a-9c2b-1f2e3d4c5b6a';
const NEW_ID = 'c2d3e4f5-6a7b-8c9d-0e1f-2a3b4c5d6e7f';
const SETTLED_ID = 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a';
const MISSING_ID = 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b';

describe('POST /cube/api/getprintings', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const router = Router();
    getprintingsRoutes.forEach((route) => {
      const method = route.method as 'get' | 'post' | 'put' | 'delete';
      router[method](route.path, ...(Array.isArray(route.handler) ? route.handler : [route.handler]));
    });
    app.use('/cube/api/getprintings', router);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects a body without an ids array', async () => {
    const res = await request(app).post('/cube/api/getprintings').send({ printing: 'recent' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/ids must be an array/);
  });

  it('rejects ids that are not card ids', async () => {
    const res = await request(app)
      .post('/cube/api/getprintings')
      .send({ ids: ['custom-card'], printing: 'recent' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/Each ID must be a valid UUID/);
  });

  it('rejects an unknown printing preference', async () => {
    const res = await request(app)
      .post('/cube/api/getprintings')
      .send({ ids: [OLD_ID], printing: 'shiniest' });

    expect(res.status).toBe(400);
    expect(getPreferredPrinting).not.toHaveBeenCalled();
  });

  it('returns only the ids that would move, keyed by the id sent', async () => {
    const newPrinting = createCardDetails({ scryfall_id: NEW_ID });
    (getPreferredPrinting as jest.Mock).mockImplementation((id: string) => {
      if (id === OLD_ID) return newPrinting;
      if (id === SETTLED_ID) return createCardDetails({ scryfall_id: SETTLED_ID });
      return null;
    });

    const res = await request(app)
      .post('/cube/api/getprintings')
      .send({ ids: [OLD_ID, SETTLED_ID, MISSING_ID, OLD_ID], printing: 'cheapest' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: 'true', printings: { [OLD_ID]: newPrinting } });
    // Repeated ids are resolved once.
    expect(getPreferredPrinting).toHaveBeenCalledTimes(3);
    expect(getPreferredPrinting).toHaveBeenCalledWith(OLD_ID, 'cheapest');
  });
});
