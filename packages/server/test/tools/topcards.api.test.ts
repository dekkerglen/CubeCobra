import * as filterCards from '@utils/filtering/FilterCards';
import { getTopCardsPage, validateQuery } from '../../src/router/routes/tool/api/topcards';
import * as tools from 'serverutils/tools';
import { createCard } from '../test-utils/data';
import { expectRegisteredRoutes } from '../test-utils/route';
import { call, middleware } from '../test-utils/transport';

describe('Top cards API', () => {
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

    const res = await call(getTopCardsPage).withQuery({ f: '', d: 'descending', s: 'Elo', p: 0 }).send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
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

    const res = await call(getTopCardsPage).withQuery({ f: 'tall:yes', d: 'descending', s: 'Elo', p: 0 }).send();

    expect(searchCards).not.toHaveBeenCalled();
    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
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

    const res = await call(getTopCardsPage).withQuery({ f: '', d: 'descending', s: 'Elo', p: 0 }).send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
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

    const res = await call(getTopCardsPage).withQuery({ f: '', d: 'descending', s: 'Elo', p: 0 }).send();

    expect(res.status).toEqual(500);
    expect(res.body).toEqual({
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

describe('Top Cards validation', () => {
  const assertPassingValidation = async (queryParams: any) => {
    const res = await middleware(validateQuery).withQuery(queryParams).send();
    expect(res.nextCalled).toBeTruthy();
  };

  const assertFailingValidation = async (queryParams: any) => {
    const res = await middleware(validateQuery).withQuery(queryParams).send();
    expect(res.status).toEqual(400);
    expect(res.nextCalled).toBeFalsy();
  };

  it('should allow the default parameter values', async () => {
    await assertPassingValidation({ f: '', d: 'descending', s: 'Elo', p: 0 });
  });

  it('all parameters must be set', async () => {
    await assertFailingValidation({ d: 'descending', s: 'Elo', p: 0 });
    await assertFailingValidation({ f: 'Ambush Viper', s: 'Elo', p: 0 });
    await assertFailingValidation({ f: 'Ambush Viper', d: 'descending', p: 0 });
    await assertFailingValidation({ f: 'Ambush Viper', d: 'descending', s: 'Elo' });
  });

  it('should disallow invalid directions', async () => {
    await assertFailingValidation({ f: '', d: 'foo', s: 'Elo', p: 0 });
  });

  it('should disallow invalid sorts', async () => {
    await assertFailingValidation({ f: '', d: 'ascending', s: 'Prime', p: 0 });
  });

  it('should disallow negative pages', async () => {
    await assertFailingValidation({ f: '', d: 'ascending', s: 'Elo', p: -1 });
  });

  it('page must be an integer', async () => {
    await assertFailingValidation({ f: '', d: 'ascending', s: 'Elo', p: 1.5 });
  });
});
