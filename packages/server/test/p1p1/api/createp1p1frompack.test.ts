import Card from '@utils/datatypes/Card';
import { CubeCards } from '@utils/datatypes/Cube';

import { createP1P1FromPackHandler } from '../../../src/router/routes/tool/api/createp1p1frompack';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../../src/dynamo/daos'),
  cubeDao: { getById: jest.fn(), getCards: jest.fn() },
  p1p1PackDao: { createPack: jest.fn() },
}));

jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(() => ({ oracle_id: 'fallback-oracle', name: 'Fallback Card' })),
}));

jest.mock('serverutils/userUtil', () => ({
  getBotPrediction: jest.fn(async () => ({ botPickIndex: 0, botWeights: [1] })),
}));

import { cubeDao, p1p1PackDao } from '../../../src/dynamo/daos';

const cubeCard = (cardID: string, board: string, index: number, tags: string[] = []): Card =>
  ({ cardID, board, index, tags, status: 'Owned', finish: 'Non-foil', details: { oracle_id: `o-${cardID}` } }) as any;

const CUBE = { id: 'cube-1', visibility: 'pu', owner: { id: 'owner-1' } };

const run = async (cards: CubeCards, packCards: { cardID: string; index?: number }[], source?: string) => {
  (cubeDao.getById as jest.Mock).mockResolvedValue(CUBE);
  (cubeDao.getCards as jest.Mock).mockResolvedValue(cards);
  (p1p1PackDao.createPack as jest.Mock).mockImplementation(async (_meta, s3Data) => ({ id: 'pack-1', ...s3Data }));

  const res = await call(createP1P1FromPackHandler)
    .as({ id: 'user-1', username: 'tester' } as any)
    .withBody({
      cubeId: 'cube-1',
      seed: 'seed-1',
      cards: packCards,
      ...(source ? { source } : {}),
    })
    .send();

  return {
    status: res.status,
    body: res.body,
    cards: (p1p1PackDao.createPack as jest.Mock).mock.calls.at(-1)?.[1]?.cards as Card[] | undefined,
  };
};

describe('createP1P1FromPack board resolution', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves a pack card that lives on a custom board', async () => {
    const cards = {
      mainboard: [cubeCard('main-1', 'mainboard', 0)],
      maybeboard: [],
      'mytestboard/test': [cubeCard('custom-1', 'mytestboard/test', 0, ['signature'])],
    } as unknown as CubeCards;

    const { cards: resolved } = await run(cards, [{ cardID: 'custom-1', index: 0 }]);

    expect(resolved).toHaveLength(1);
    // The real cube card carries its tags; the synthetic fallback would not.
    expect(resolved![0]!.tags).toEqual(['signature']);
    expect(resolved![0]!.cardID).toBe('custom-1');
  });

  it('picks the card matching the cardID when indexes collide across boards', async () => {
    const cards = {
      mainboard: [cubeCard('main-1', 'mainboard', 0, ['from-mainboard'])],
      maybeboard: [],
      'mytestboard/test': [cubeCard('custom-1', 'mytestboard/test', 0, ['from-custom'])],
    } as unknown as CubeCards;

    const { cards: resolved } = await run(cards, [{ cardID: 'custom-1', index: 0 }]);

    expect(resolved![0]!.tags).toEqual(['from-custom']);
  });

  it('still resolves mainboard cards by cardID when no index is given', async () => {
    const cards = {
      mainboard: [cubeCard('main-1', 'mainboard', 0, ['from-mainboard'])],
      maybeboard: [],
    } as unknown as CubeCards;

    const { cards: resolved } = await run(cards, [{ cardID: 'main-1' }]);

    expect(resolved![0]!.tags).toEqual(['from-mainboard']);
  });
});

describe('createP1P1FromPack custom packs', () => {
  beforeEach(() => jest.clearAllMocks());

  const cards = {
    mainboard: [cubeCard('main-1', 'mainboard', 0)],
    maybeboard: [cubeCard('maybe-1', 'maybeboard', 0)],
  } as unknown as CubeCards;

  it('stores the custom source', async () => {
    const { status } = await run(cards, [{ cardID: 'main-1', index: 0 }], 'custom');

    expect(status).toBe(200);
    expect((p1p1PackDao.createPack as jest.Mock).mock.calls[0][1].source).toBe('custom');
  });

  it('rejects a card that is not in the cube instead of falling back to the catalog', async () => {
    const { status } = await run(cards, [{ cardID: 'not-in-cube', index: 5 }], 'custom');

    expect(status).toBe(400);
    expect(p1p1PackDao.createPack).not.toHaveBeenCalled();
  });

  it('rejects maybeboard cards', async () => {
    const { status } = await run(cards, [{ cardID: 'maybe-1', index: 0 }], 'custom');

    expect(status).toBe(400);
  });

  it('leaves random packs without a source', async () => {
    await run(cards, [{ cardID: 'main-1', index: 0 }]);

    expect((p1p1PackDao.createPack as jest.Mock).mock.calls[0][1].source).toBeUndefined();
  });
});
