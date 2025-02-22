import express, { Application } from 'express';
import { PublishDraftBody, routes } from 'src/router/routes/api/draftmancer/publish';
import { getReasonableCardByOracle } from 'src/util/carddb';
import request from 'supertest';

import Cube from '../../src/dynamo/models/cube';
import Draft from '../../src/dynamo/models/draft';
import { RequestHandler } from '../../src/types/express';
import { createCardDetails, createCube } from '../test-utils/data';

jest.mock('../../src/util/draftbots', () => ({
  deckbuild: jest.fn(),
}));

jest.mock('../../src/dynamo/models/cube', () => ({
  getById: jest.fn(),
}));

jest.mock('../../src/util/carddb', () => ({
  getReasonableCardByOracle: jest.fn(),
}));

jest.mock('../../src/dynamo/models/draft', () => ({
  put: jest.fn(),
}));

describe('Publish', () => {
  let app: Application;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    //Need to type as our RequestHandler or Typescript gets angry
    app.post('/api/draftmancer/publish', ...(routes[0].handler as RequestHandler[]));

    process.env.DRAFTMANCER_API_KEY = 'api-key';
  });

  it('requires a valid api key', async () => {
    let response = await request(app)
      .post('/api/draftmancer/publish')
      .send(createRequest({ apiKey: '' }));
    expect(response.status).toBe(400);

    response = await request(app)
      .post('/api/draftmancer/publish')
      .send(createRequest({ apiKey: 'invalid api key' }));
    expect(response.status).toBe(401);
  });

  it('should accept a valid request without bots', async () => {
    const cube = createCube({ id: 'my-cube' });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (getReasonableCardByOracle as jest.Mock).mockReturnValue(createCardDetails());
    (Draft.put as jest.Mock).mockResolvedValue('uuid');

    const response = await request(app)
      .post('/api/draftmancer/publish')
      .send(createRequest({ cubeID: cube.id }));

    expect(response.status).toBe(200);
    expect(Cube.getById).toHaveBeenCalledWith(cube.id);
    expect(Draft.put).toHaveBeenCalled();
  });
});

const createRequest = (overrides?: Partial<PublishDraftBody>): PublishDraftBody => {
  return {
    cubeID: 'cubeID',
    sessionID: 'sessionID',
    timestamp: 0,
    players: [
      {
        userName: 'drafter-1',
        isBot: false,
        picks: [
          {
            booster: ['7b55019a-df05-4b09-a970-3fde8e892fda'],
            picks: [1, 3, 5, 7, 9],
            burn: [],
          },
          {
            booster: ['56f7614e-5430-4b9b-a3a0-9ab8f9cebf99'],
            picks: [1, 3, 5, 7, 9],
            burn: [],
          },
          {
            booster: ['79c00bbe-6a46-465a-9f41-6048b87422c1'],
            picks: [1, 3, 5, 7, 9],
            burn: [],
          },
        ],
        decklist: {
          main: ['ff9ec6e7-a4ac-46b8-ad6e-697f36de01b8'],
          side: ['e8863cd7-68d7-4996-a194-97d56305fcb9'],
          lands: {
            W: 2,
            U: 3,
            B: 5,
            R: 7,
            G: 10,
          },
        },
      },
    ],
    apiKey: 'api-key',
    ...overrides,
  };
};
