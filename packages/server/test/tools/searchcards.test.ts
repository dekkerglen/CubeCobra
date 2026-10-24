import * as filterCards from '@utils/filtering/FilterCards';
import * as tools from 'serverutils/tools';

import { searchCardsHandler } from '../../src/router/routes/tool/api/searchcards';
import { csvHandler } from '../../src/router/routes/tool/searchcards';
import { Request, Response } from '../../src/types/express';
import { createCardDetails } from '../test-utils/data';
import { expectRegisteredRoutes } from '../test-utils/route';
import { call } from '../test-utils/transport';

// The CSV handler streams via res.setHeader/write/end, which the shared mock
// response doesn't support, so capture output with a purpose-built response.
const createStreamingResponse = () => {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  const res = {
    statusCode: 200,
    charset: '',
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end() {
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      chunks.push(String(payload));
      return this;
    },
  };
  return {
    res: res as unknown as Response,
    headers,
    chunks,
    get body() {
      return chunks.join('');
    },
  };
};

const createRequest = (query: Record<string, any>): Request =>
  ({ query, logger: { error: jest.fn(), info: jest.fn() } }) as unknown as Request;

describe('Search cards CSV export', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('streams a CSV of every matching card', async () => {
    jest.spyOn(filterCards, 'makeFilter').mockImplementation(() => ({
      err: false,
      filter: (() => true) as any,
    }));

    const cards = [
      createCardDetails({
        name: 'Test Card',
        cmc: 3,
        type: 'Creature — Elf',
        colors: ['g'],
        set: 'abc',
        collector_number: '42',
        rarity: 'mythic',
        elo: 1500,
        pickCount: 250,
        cubeCount: 99,
      }),
    ];
    jest.spyOn(tools, 'searchAllCards').mockImplementation(() => cards);

    // Read stream.body via the live getter after the handler writes; destructuring it here would
    // freeze it to the empty value captured before csvHandler runs.
    const stream = createStreamingResponse();
    await csvHandler(createRequest({ f: '', s: 'Elo', d: 'descending', di: 'names', ie: '0' }), stream.res);

    expect(stream.headers['Content-type']).toEqual('text/csv');
    expect(stream.headers['Content-disposition']).toEqual('attachment; filename=cardsearch.csv');

    const lines = stream.body.trim().split('\r\n');
    expect(lines[0]).toEqual('Name,CMC,Type,Color,Set,Collector Number,Rarity,Elo,Total Picks,Cube Count');
    // Type's em dash is normalized to a hyphen so it survives the CSV round-trip.
    expect(lines[1]).toEqual('"Test Card",3,"Creature - Elf",g,"abc","42",mythic,1500,250,99');
  });

  it('leaves analytics columns blank when the card has no data', async () => {
    jest.spyOn(filterCards, 'makeFilter').mockImplementation(() => ({
      err: false,
      filter: (() => true) as any,
    }));

    const cards = [
      createCardDetails({
        name: 'No Stats',
        cmc: 1,
        type: 'Instant',
        colors: [],
        set: 'xyz',
        collector_number: '7',
        rarity: 'common',
        elo: null as any,
        pickCount: null as any,
        cubeCount: null as any,
      }),
    ];
    jest.spyOn(tools, 'searchAllCards').mockImplementation(() => cards);

    const stream = createStreamingResponse();
    await csvHandler(createRequest({ f: '', s: 'Elo', d: 'descending', di: 'names', ie: '0' }), stream.res);

    const lines = stream.body.trim().split('\r\n');
    expect(lines[0]).toEqual('Name,CMC,Type,Color,Set,Collector Number,Rarity,Elo,Total Picks,Cube Count');
    expect(lines[1]).toEqual('"No Stats",1,"Instant",,"xyz","7",common,,,');
  });

  it('returns 400 when the filter is invalid', async () => {
    jest.spyOn(filterCards, 'makeFilter').mockImplementation(() => ({
      err: true as any,
      filter: null as any,
    }));
    const searchAllCards = jest.spyOn(tools, 'searchAllCards');

    const { res } = createStreamingResponse();
    await csvHandler(createRequest({ f: 'tall:yes', s: 'Elo', d: 'descending' }), res);

    expect(searchAllCards).not.toHaveBeenCalled();
    expect((res as any).statusCode).toEqual(400);
  });

  it('returns 400 without parsing when the filter is too long or not a single value', async () => {
    const makeFilter = jest.spyOn(filterCards, 'makeFilter');
    const searchAllCards = jest.spyOn(tools, 'searchAllCards');

    for (const f of ['a'.repeat(filterCards.MAX_SEARCH_FILTER_LENGTH + 1), ['t:creature', 'c:r']]) {
      const { res } = createStreamingResponse();
      await csvHandler(createRequest({ f, s: 'Elo', d: 'descending' }), res);
      expect((res as any).statusCode).toEqual(400);
    }

    expect(makeFilter).not.toHaveBeenCalled();
    expect(searchAllCards).not.toHaveBeenCalled();
  });
});

describe('Search cards API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 400 without parsing when the filter is too long or not a single value', async () => {
    const makeFilter = jest.spyOn(filterCards, 'makeFilter');
    const searchCards = jest.spyOn(tools, 'searchCards');

    for (const f of ['a'.repeat(filterCards.MAX_SEARCH_FILTER_LENGTH + 1), ['t:creature', 'c:r']]) {
      const res = await call(searchCardsHandler).withQuery({ f, s: 'Elo', d: 'descending', p: '0' }).send();
      expect(res.status).toEqual(400);
      expect(res.body).toEqual({ success: 'false', numResults: 0, data: [] });
    }

    expect(makeFilter).not.toHaveBeenCalled();
    expect(searchCards).not.toHaveBeenCalled();
  });

  it('searches with a filter at the length limit', async () => {
    jest.spyOn(tools, 'searchCards').mockImplementation(() => ({ data: [], numResults: 0 }));

    const f = 'a'.repeat(filterCards.MAX_SEARCH_FILTER_LENGTH);
    const res = await call(searchCardsHandler).withQuery({ f, s: 'Elo', d: 'descending', p: '0' }).send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({ success: 'true', data: [], numResults: 0 });
  });
});

describe('Search cards routes', () => {
  it('should register its own routes', async () => {
    expectRegisteredRoutes([
      {
        path: '/tool/searchcards/',
        method: 'get',
      },
      {
        path: '/tool/searchcards/csv',
        method: 'get',
      },
    ]);
  });
});
