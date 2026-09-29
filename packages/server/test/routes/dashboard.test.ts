jest.mock('../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../src/dynamo/daos'),
  collaboratorIndexDao: { getCubeIdsForUser: jest.fn() },
  cubeDao: { batchGet: jest.fn(), queryByOwner: jest.fn() },
}));

jest.mock('serverutils/featuredQueue', () => ({ getFeaturedCubes: jest.fn() }));
jest.mock('serverutils/dailyGamePick', () => ({ pickDailyGame: jest.fn() }));
jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  render: jest.fn(),
  redirect: jest.fn(),
  handleRouteError: jest.fn(),
  getPinnedCubesForOwner: jest.fn(),
}));

import { collaboratorIndexDao, cubeDao } from '../../src/dynamo/daos';
import { routes } from '../../src/router/routes/dashboard';
import { pickDailyGame } from '../../src/serverutils/dailyGamePick';
import { getFeaturedCubes } from '../../src/serverutils/featuredQueue';
import { getPinnedCubesForOwner, redirect, render } from '../../src/serverutils/render';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

// The handler itself is not exported; it is the last element of the '' GET route.
const dashboardHandler = routes.find((route) => route.path === '')!.handler.at(-1)!;

const renderedProps = () => (render as jest.Mock).mock.calls[0]![3];

const DAILY_GAME = {
  teaser: { game: 'crossword', shape: { date: '2026-09-29', width: 3, height: 3, blocks: [], clueCount: 2 } },
  allPlayed: false,
};

describe('dashboard handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getFeaturedCubes as jest.Mock).mockResolvedValue([]);
    (pickDailyGame as jest.Mock).mockResolvedValue(DAILY_GAME);
    (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockResolvedValue([]);
    (cubeDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [] });
    (getPinnedCubesForOwner as jest.Mock).mockResolvedValue({ pinnedCubes: [], pinnedIds: new Set() });
  });

  it('hands the page one daily game rather than the Daily P1P1 it used to', async () => {
    await call(dashboardHandler as any)
      .as(createUser({ id: 'user-1' }))
      .send();

    const props = renderedProps();
    expect(props.dailyGame).toEqual(DAILY_GAME);
    // The old props are gone; leaving them would quietly render two daily cards.
    expect(props).not.toHaveProperty('dailyP1P1');
    expect(props).not.toHaveProperty('dailyManaMatrix');
  });

  it('picks for the logged-in user', async () => {
    await call(dashboardHandler as any)
      .as(createUser({ id: 'user-1' }))
      .send();

    expect(pickDailyGame).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', includeDailyP1P1: true }));
  });

  it('keeps Daily P1P1 out of the rotation for users who hid featured cubes', async () => {
    await call(dashboardHandler as any)
      .as(createUser({ id: 'user-1', hideFeatured: true }))
      .send();

    expect(pickDailyGame).toHaveBeenCalledWith(expect.objectContaining({ includeDailyP1P1: false }));
  });

  it('issues the independent reads together rather than one after another', async () => {
    // Every one of these resolves only once all of them have been called, so the test
    // deadlocks (and times out) if the handler ever awaits them in sequence again.
    const started: string[] = [];
    let release: () => void;
    const allStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gate = (name: string, value: any) => async () => {
      started.push(name);
      if (started.length === 4) {
        release();
      }
      await allStarted;
      return value;
    };

    (getFeaturedCubes as jest.Mock).mockImplementation(gate('featured', []));
    (pickDailyGame as jest.Mock).mockImplementation(gate('dailyGame', DAILY_GAME));
    (collaboratorIndexDao.getCubeIdsForUser as jest.Mock).mockImplementation(gate('collaborating', []));
    (cubeDao.queryByOwner as jest.Mock).mockImplementation(gate('ownedCubes', { items: [] }));

    await call(dashboardHandler as any)
      .as(createUser({ id: 'user-1' }))
      .send();

    expect(started).toHaveLength(4);
    expect(render).toHaveBeenCalled();
  });

  it('sends anonymous visitors to the landing page', async () => {
    await call(dashboardHandler as any).send();

    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/landing');
    expect(pickDailyGame).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });
});
