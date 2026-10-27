import { render } from 'serverutils/render';

import { cubeDao, draftDao } from '../../src/dynamo/daos';
import { routes } from '../../src/router/routes/draft/deckbuilder';
import { createCompletedSoloDraft, createCube, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('../../src/dynamo/daos');
jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn((id: string) => ({ scryfall_id: id, type: 'Basic Land — Forest' })),
}));
jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));
jest.mock('serverutils/cubefn', () => ({
  abbreviate: jest.fn((name: string) => name),
  isCubeViewable: jest.fn(() => true),
}));
jest.mock('serverutils/meta', () => jest.fn(() => []));
jest.mock('serverutils/util', () => ({ getBaseUrl: jest.fn(() => 'http://localhost') }));

const handler = routes[0]!.handler[0] as any;

describe('Deckbuilder basics backfill', () => {
  const owner = createUser();
  const cube = createCube({ basicsBoard: 'Basics-' } as any);

  // An uploaded deck made before the cube had a Basics board: no basics, no recorded board.
  const uploaded = () => createCompletedSoloDraft({ owner, cube: cube.id, type: 'u', basics: [] });

  beforeEach(() => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [], basics: [{ cardID: 'forest' }] });
    (draftDao.backfillBasics as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    // clear, not reset: reset would wipe the module-factory mocks (isCubeViewable, ...).
    jest.clearAllMocks();
  });

  const open = (deck: any) => {
    (draftDao.getById as jest.Mock).mockResolvedValue(deck);
    return call(handler).as(owner).withParams({ id: deck.id }).send();
  };

  it('fills in basics from the cube Basics board', async () => {
    const deck = uploaded();
    await open(deck);

    const poolSize = deck.cards.length;
    expect(draftDao.backfillBasics).toHaveBeenCalledWith(deck.id, poolSize, [
      expect.objectContaining({ cardID: 'forest', index: poolSize, isUnlimited: true }),
    ]);
    // Re-read so the page gets the persisted pool with details.
    expect(draftDao.getById).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenCalled();
  });

  it('leaves a draft that already has basics alone', async () => {
    await open(createCompletedSoloDraft({ owner, cube: cube.id }));

    expect(cubeDao.getCards).not.toHaveBeenCalled();
    expect(draftDao.backfillBasics).not.toHaveBeenCalled();
  });

  it('respects a draft created with None', async () => {
    await open({ ...uploaded(), basicsBoard: 'None' });

    expect(draftDao.backfillBasics).not.toHaveBeenCalled();
  });

  it('still renders when the backfill fails', async () => {
    (draftDao.backfillBasics as jest.Mock).mockRejectedValue(new Error('s3 down'));

    await open(uploaded());

    expect(render).toHaveBeenCalled();
  });
});
