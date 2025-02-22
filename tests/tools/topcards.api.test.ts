import * as filterCards from '../../src/client/filtering/FilterCards';
import { getTopCardsPage } from '../../src/router/routes/tool/api/topcards';
import { Response } from '../../src/types/express';
import * as tools from '../../src/util/tools';
import { createCard } from '../test-utils/data';
import { expectRegisteredRoutes } from '../test-utils/route';
import { call } from '../test-utils/transport';

describe('Top cards API', () => {
  let res: Partial<Response>;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass with default parameters', async () => {
    jest.spyOn(filterCards, 'makeFilter');
    (filterCards.makeFilter as jest.Mock).mockImplementation(() => ({
      err: false,
      filter: () => {
        return true;
      },
    }));

    jest.spyOn(tools, 'searchCards');
    (tools.searchCards as jest.Mock).mockImplementation(() => ({ data: [], numResults: 0 }));

    await call(getTopCardsPage).withQuery({ f: '', d: 'descending', s: 'Elo', p: 0 }).withResponse(res).send();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      data: [],
      numResults: 0,
    });
  });

  it('should fail if filter is invalid', async () => {
    jest.spyOn(filterCards, 'makeFilter');
    (filterCards.makeFilter as jest.Mock).mockImplementation(() => ({
      err: true,
      filter: null,
    }));

    const searchCards = jest.spyOn(tools, 'searchCards');
    (tools.searchCards as jest.Mock).mockImplementation(() => ({ data: [], numResults: 0 }));

    await call(getTopCardsPage).withQuery({ f: 'tall:yes', d: 'descending', s: 'Elo', p: 0 }).withResponse(res).send();

    expect(searchCards).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: 'false',
      data: [],
      numResults: 0,
    });
  });

  it('should successfuly search', async () => {
    jest.spyOn(filterCards, 'makeFilter');
    (filterCards.makeFilter as jest.Mock).mockImplementation(() => ({
      err: false,
      filter: () => {
        return true;
      },
    }));

    const cards = [createCard(), createCard(), createCard()];

    jest.spyOn(tools, 'searchCards');
    (tools.searchCards as jest.Mock).mockImplementation(() => ({ data: cards, numResults: 3 }));

    await call(getTopCardsPage).withQuery({ f: '', d: 'descending', s: 'Elo', p: 0 }).withResponse(res).send();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      data: cards,
      numResults: 3,
    });
  });

  it('should handle errors', async () => {
    jest.spyOn(filterCards, 'makeFilter');
    (filterCards.makeFilter as jest.Mock).mockImplementation(() => {
      throw new Error('Failed to search');
    });

    await call(getTopCardsPage).withQuery({ f: '', d: 'descending', s: 'Elo', p: 0 }).withResponse(res).send();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: 'false',
      data: [],
      numResults: 0,
    });
  });
});

describe('Top Cards Routes', () => {
  it('should register its own routes', async () => {
    expectRegisteredRoutes([
      {
        path: '/tool/api/topcards/',
        method: 'get',
      },
    ]);
  });
});
