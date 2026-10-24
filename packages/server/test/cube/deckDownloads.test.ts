import * as carddb from 'serverutils/carddb';
import * as cubefn from 'serverutils/cubefn';
import * as render from 'serverutils/render';

import { cubeDao, draftDao } from '../../src/dynamo/daos';
import {
  downloadArenaHandler,
  downloadCockatriceHandler,
  downloadCsvHandler,
  downloadForgeHandler,
  downloadMtgoHandler,
  downloadTopdeckedHandler,
  downloadTxtHandler,
  downloadXmageHandler,
} from '../../src/router/routes/cube/deck';
import { Request, Response } from '../../src/types/express';
import { createCard, createCardDetails, createCompletedSoloDraft, createCube, createUser } from '../test-utils/data';

jest.mock('../../src/dynamo/daos');
jest.mock('serverutils/carddb');
jest.mock('serverutils/cubefn', () => ({
  ...jest.requireActual('serverutils/cubefn'),
  isCubeViewable: jest.fn(),
}));
jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));

// The download handlers stream with setHeader/attachment/write/end, so capture them directly.
const createStreamingResponse = () => {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  const res = {
    charset: '',
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    attachment(filename: string) {
      headers['content-disposition'] = `attachment; filename="${filename}"`;
      return this;
    },
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end() {
      return this;
    },
  };
  return { res: res as unknown as Response, headers, body: () => chunks.join('') };
};

const createRequest = (params: Record<string, string>, user?: any) =>
  ({ params, query: {}, user, flash: jest.fn(), logger: { error: jest.fn() } }) as unknown as Request;

const handlers = {
  xmage: downloadXmageHandler,
  forge: downloadForgeHandler,
  txt: downloadTxtHandler,
  mtgo: downloadMtgoHandler,
  arena: downloadArenaHandler,
  cockatrice: downloadCockatriceHandler,
  topdecked: downloadTopdeckedHandler,
  csv: downloadCsvHandler,
};

describe('Deck downloads', () => {
  const cube = createCube({ visibility: 'pr' });
  const card = createCard({
    cardID: 'card-1',
    details: createCardDetails({ name: '=cmd|"/c calc"!A1', oracle_id: 'oracle-1', set: 'abc' }),
  });
  const deck = createCompletedSoloDraft({ id: 'deck-1', cube: cube.id, cards: [card] });
  deck.seats[0]!.name = 'Seat Zero';
  deck.seats[0]!.mainboard = [[[0]]];
  deck.seats[0]!.sideboard = [[[]]];

  beforeEach(() => {
    (draftDao.getById as jest.Mock).mockResolvedValue(deck);
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (carddb.cardFromId as jest.Mock).mockReturnValue(card.details);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each(Object.entries(handlers))(
    '%s: reports a deck from a cube the viewer cannot see as not found',
    async (_name, handler) => {
      (cubefn.isCubeViewable as jest.Mock).mockReturnValue(false);
      const req = createRequest({ id: 'deck-1', seat: '0' }, createUser());
      const stream = createStreamingResponse();

      await handler(req, stream.res);

      expect(cubeDao.getById).toHaveBeenCalledWith(cube.id);
      expect(cubefn.isCubeViewable).toHaveBeenCalledWith(cube, req.user);
      expect(req.flash).toHaveBeenCalledWith('danger', 'Deck not found');
      expect(render.redirect).toHaveBeenCalledWith(req, stream.res, '/404');
      expect(stream.body()).toBe('');
    },
  );

  it.each(Object.entries(handlers))('%s: downloads a deck from a viewable cube', async (_name, handler) => {
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    const req = createRequest({ id: 'deck-1', seat: '0' });
    const stream = createStreamingResponse();

    await handler(req, stream.res);

    expect(render.redirect).not.toHaveBeenCalled();
    expect(stream.body()).not.toBe('');
  });

  it('reports a missing deck as not found', async () => {
    (draftDao.getById as jest.Mock).mockResolvedValue(null);
    const req = createRequest({ id: 'missing', seat: '0' });

    await downloadTxtHandler(req, createStreamingResponse().res);

    expect(req.flash).toHaveBeenCalledWith('danger', 'Deck not found');
    expect(cubeDao.getById).not.toHaveBeenCalled();
  });

  it('rejects a seat that does not exist', async () => {
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    const req = createRequest({ id: 'deck-1', seat: '-1' });

    await downloadTopdeckedHandler(req, createStreamingResponse().res);

    expect(req.flash).toHaveBeenCalledWith('danger', 'Invalid seat');
  });

  it('builds the TopDecked filename from the loaded deck and parsed seat, not raw params', async () => {
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    const req = createRequest({ id: 'deck-1', seat: '0;"evil.html' });
    const stream = createStreamingResponse();

    await downloadTopdeckedHandler(req, stream.res);

    expect(stream.headers['content-disposition']).toBe('attachment; filename="deck-1_0.csv"');
  });
});
