import { addtocubeHandler } from '../../src/router/routes/cube/api/addtocube';
import { updateBoardsHandler } from '../../src/router/routes/cube/updateboards';
import { updateBoardsAndViewsHandler } from '../../src/router/routes/cube/updateboardsandviews';
import { createCardWithoutDetails, createCube } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  redirect: jest.fn(),
}));

jest.mock('serverutils/carddb', () => ({
  ...jest.requireActual('serverutils/carddb'),
  cardFromId: jest.fn((id: string) => ({ scryfall_id: id, name: id, cmc: 0, type: 'Creature', colors: [] })),
}));

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
    update: jest.fn(),
    updateCards: jest.fn(),
  },
  changelogDao: { createChangelog: jest.fn().mockResolvedValue('log') },
  packageDao: { getById: jest.fn() },
  blogDao: { createBlog: jest.fn() },
  feedDao: { batchPutUnhydrated: jest.fn() },
  userDao: { getAllFollowers: jest.fn().mockResolvedValue([]) },
}));

import { cubeDao } from '../../src/dynamo/daos';

describe('board updates reject reserved names', () => {
  const cube = createCube();

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [createCardWithoutDetails()], maybeboard: [] });
  });

  it('updateboards refuses a __proto__ board', async () => {
    const res = await call(updateBoardsHandler)
      .as(cube.owner)
      .withParams({ id: cube.id })
      .withBody({ boards: [{ name: 'Mainboard' }, { name: '__proto__' }] })
      .send();

    expect(res.status).toBe(400);
    expect(cubeDao.updateCards).not.toHaveBeenCalled();
  });

  it('updateboardsandviews refuses a constructor board', async () => {
    const flash = jest.fn();
    await call(updateBoardsAndViewsHandler)
      .as(cube.owner)
      .withFlash(flash)
      .withParams({ id: cube.id })
      .withBody({
        boards: JSON.stringify([{ name: 'Mainboard' }, { name: 'Constructor' }]),
        views: JSON.stringify([]),
      })
      .send();

    expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining("can't be used as a board name"));
    expect(cubeDao.updateCards).not.toHaveBeenCalled();
  });

  it('updateboards keeps cards for ordinary boards', async () => {
    const res = await call(updateBoardsHandler)
      .as(cube.owner)
      .withParams({ id: cube.id })
      .withBody({ boards: [{ name: 'Mainboard' }, { name: 'Tokens' }] })
      .send();

    expect(res.status).toBe(200);
    const saved = (cubeDao.updateCards as jest.Mock).mock.calls[0][1];
    expect(Object.keys(saved)).toEqual(['mainboard', 'tokens']);
    expect(saved.mainboard).toHaveLength(1);
  });
});

describe('addtocube', () => {
  const cube = createCube();

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
  });

  const add = (body: Record<string, unknown>) =>
    call(addtocubeHandler).as(cube.owner).withParams({ id: cube.id }).withBody(body).send();

  it.each([['__proto__'], ['constructor'], [['mainboard']]])('rejects the board %p', async (board) => {
    const res = await add({ cards: ['a'], board });

    expect(res.status).toBe(400);
    expect(cubeDao.updateCards).not.toHaveBeenCalled();
    expect((Object.prototype as any)[0]).toBeUndefined();
  });

  it('rejects a request without a card list', async () => {
    const res = await add({ cards: 'a' });

    expect(res.status).toBe(400);
    expect(cubeDao.updateCards).not.toHaveBeenCalled();
  });
});
