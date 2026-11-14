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

  it('quotes and neutralizes every TopDecked CSV cell', async () => {
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    const stream = createStreamingResponse();

    await downloadTopdeckedHandler(createRequest({ id: 'deck-1', seat: '0' }), stream.res);

    const lines = stream.body().trim().split('\r\n');
    expect(lines[0]).toBe('Quantity,"Name",Scryfall,Zone');
    expect(lines[1]).toBe('"1","\'=cmd|""/c calc""!A1","card-1","main"');
  });
  describe('formatting and escaping', () => {
    // Seat names are user-supplied, and the text formats have no quoting, so they are the deck
    // equivalent of the cube-name injection the cube exports guard against.
    const seatedDeck = (seatName: string, cards: any[], mainboard: number[][][] = [[[0]]]) => {
      const built = createCompletedSoloDraft({ id: 'deck-2', cube: cube.id, cards });
      built.seats[0]!.name = seatName;
      built.seats[0]!.mainboard = mainboard;
      built.seats[0]!.sideboard = [[[]]];
      return built;
    };

    const run = async (handler: any, built: any) => {
      (draftDao.getById as jest.Mock).mockResolvedValue(built);
      (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
      const stream = createStreamingResponse();
      await handler(createRequest({ id: 'deck-2', seat: '0' }), stream.res);
      return stream;
    };

    const unprinted = createCard({
      cardID: 'custom-card',
      custom_name: 'My Custom',
      details: createCardDetails({ name: 'Invalid Card', oracle_id: 'oracle-2', set: '', collector_number: '' }),
    });

    beforeEach(() => {
      (carddb.cardFromId as jest.Mock).mockImplementation((id: string) =>
        id === 'custom-card' ? unprinted.details : card.details,
      );
    });

    it.each([
      ['xmage', downloadXmageHandler],
      ['forge', downloadForgeHandler],
    ])('%s: stops a seat name from adding a line of its own', async (_name, handler) => {
      const stream = await run(handler, seatedDeck('Evil\r\n1 Black Lotus', [card]));

      expect(stream.body()).toContain('Evil 1 Black Lotus');
      expect(stream.body()).not.toMatch(/\r\n1 Black Lotus/);
    });

    it('falls back to a usable filename when the seat name has no word characters', async () => {
      const stream = await run(downloadTxtHandler, seatedDeck('キューブ', [card]));

      expect(stream.headers['content-disposition']).toBe('attachment; filename=deck.txt');
    });

    it('xmage: omits the version block for a card with no printing', async () => {
      const stream = await run(downloadXmageHandler, seatedDeck('Seat', [unprinted]));

      expect(stream.body()).toContain('1 My Custom');
      expect(stream.body()).not.toContain('[:]');
    });

    it('forge: drops the set separator for a card with no printing', async () => {
      const stream = await run(downloadForgeHandler, seatedDeck('Seat', [unprinted]));

      expect(stream.body()).toContain('1 My Custom\r\n');
    });

    it.each([
      ['txt', downloadTxtHandler],
      ['mtgo', downloadMtgoHandler],
      ['cockatrice', downloadCockatriceHandler],
      ['arena', downloadArenaHandler],
    ])('%s: names a custom card by its own name, not the catalog placeholder', async (_name, handler) => {
      const stream = await run(handler, seatedDeck('Seat', [unprinted]));

      expect(stream.body()).toContain('My Custom');
      expect(stream.body()).not.toContain('Invalid Card');
    });

    it('still groups identical cards behind a quantity', async () => {
      const stream = await run(downloadCockatriceHandler, seatedDeck('Seat', [unprinted], [[[0, 0]]]));

      expect(stream.body()).toContain('2x My Custom');
    });
  });
});
