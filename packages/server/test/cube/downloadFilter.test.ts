import { MAX_SEARCH_FILTER_LENGTH } from '@utils/filtering/FilterCards';
import { cardFromId } from 'serverutils/carddb';
import * as render from 'serverutils/render';

import { cubeDao } from '../../src/dynamo/daos';
import { plaintextHandler } from '../../src/router/routes/cube/download';
import { Request, Response } from '../../src/types/express';
import { createCardFromDetails, createCube } from '../test-utils/data';

jest.mock('../../src/dynamo/daos');
jest.mock('serverutils/carddb', () => ({ cardFromId: jest.fn() }));
jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
}));

const createStreamingResponse = () => {
  const chunks: string[] = [];
  const res = {
    charset: '',
    setHeader: jest.fn(),
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end() {
      return this;
    },
  };
  return { res: res as unknown as Response, body: () => chunks.join('') };
};

const createRequest = (query: Record<string, unknown>) =>
  ({ params: { id: 'cube-1' }, query, flash: jest.fn(), logger: { error: jest.fn() } }) as unknown as Request;

describe('cube download filters', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['too long', 'a'.repeat(MAX_SEARCH_FILTER_LENGTH + 1)],
    ['repeated', ['c:r', 'c:g']],
    ['unparseable', 'o:"unclosed'],
  ])('rejects a %s filter before loading the cube', async (_label, filter) => {
    const req = createRequest({ filter });

    await plaintextHandler(req, createStreamingResponse().res);

    expect(cubeDao.getById).not.toHaveBeenCalled();
    expect(render.handleRouteError).toHaveBeenCalledWith(
      req,
      expect.anything(),
      expect.objectContaining({ message: 'The filter for this download is not valid.' }),
      '/404',
    );
  });

  it('filters once and writes each requested board once', async () => {
    const cube = createCube({ id: 'cube-1', visibility: 'pu' });
    const red = createCardFromDetails({ name: 'Shock', name_lower: 'shock', colors: ['R'] });
    const green = createCardFromDetails({ name: 'Giant Growth', name_lower: 'giant growth', colors: ['G'] });
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [red, green] });
    (cardFromId as jest.Mock).mockImplementation((id: string) => [red, green].find((c) => c.cardID === id)!.details);
    const stream = createStreamingResponse();

    await plaintextHandler(
      createRequest({ filter: 'sho', boards: 'mainboard,mainboard,mainboard', showother: 'true' }),
      stream.res,
    );

    expect(render.handleRouteError).not.toHaveBeenCalled();
    expect(stream.body()).toBe('# mainboard\r\nShock\r\n\r\n');
  });
});
