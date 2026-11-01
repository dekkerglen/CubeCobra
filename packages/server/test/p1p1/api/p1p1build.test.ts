import Card from '@utils/datatypes/Card';
import { CubeCards } from '@utils/datatypes/Cube';

import { p1p1BuildHandler } from '../../../src/router/routes/cube/api/p1p1build';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../../src/dynamo/daos'),
  cubeDao: { getById: jest.fn(), getCards: jest.fn() },
}));

// Ratings come from the oracle id ("o-<rating>-<name>"), highest first like the real model.
jest.mock('serverutils/ml', () => ({
  batchDraft: jest.fn(async (inputs: { pack: string[] }[]) =>
    inputs.map(({ pack }) =>
      pack.map((oracle) => ({ oracle, rating: Number(oracle.split('-')[1]) })).sort((a, b) => b.rating - a.rating),
    ),
  ),
}));

import { cubeDao } from '../../../src/dynamo/daos';

const cubeCard = (name: string, rating: number, index: number, board = 'mainboard'): Card =>
  ({ cardID: `id-${name}`, board, index, details: { name, oracle_id: `o-${rating}-${name}` } }) as any;

const CUBE = { id: 'cube-1', visibility: 'pu', owner: { id: 'owner-1' } };

const run = async (cards: CubeCards, slots: unknown[], mode: string, fill?: number[]) => {
  (cubeDao.getById as jest.Mock).mockResolvedValue(CUBE);
  (cubeDao.getCards as jest.Mock).mockResolvedValue(cards);
  return call(p1p1BuildHandler)
    .as({ id: 'user-1', username: 'tester' } as any)
    .withParams({ id: 'cube-1' })
    .withBody({ slots, mode, fill })
    .send();
};

const ref = (card: Card) => ({ cardID: card.cardID, index: card.index });

describe('p1p1Build', () => {
  beforeEach(() => jest.clearAllMocks());

  it('scores filled slots in place and leaves empty slots empty', async () => {
    const a = cubeCard('a', 0.2, 0);
    const b = cubeCard('b', 0.9, 1);
    const res = await run({ mainboard: [a, b], maybeboard: [] } as any, [ref(a), null, ref(b)], 'score');

    expect(res.status).toBe(200);
    expect(res.body.cards.map((c: Card | null) => c?.details?.name ?? null)).toEqual(['a', null, 'b']);
    expect(res.body.botWeights).toEqual([0.2, null, 0.9]);
    // Bot pick is reported as a slot position, not a position among filled slots.
    expect(res.body.botPick).toBe(2);
  });

  it('fills empty slots from the mainboard without reusing pack cards', async () => {
    const mainboard = [0, 1, 2, 3].map((i) => cubeCard(`c${i}`, 0.1 * (i + 1), i));
    const res = await run(
      { mainboard, maybeboard: [cubeCard('m', 1, 0, 'maybeboard')] } as any,
      [ref(mainboard[0]!), null, null],
      'random',
    );

    expect(res.status).toBe(200);
    const names = res.body.cards.map((c: Card) => c.details!.name);
    expect(names[0]).toBe('c0');
    expect(new Set(names).size).toBe(3);
    expect(names).not.toContain('m');
  });

  it('fills only the listed slot when given one, leaving other empty slots empty', async () => {
    const mainboard = [0, 1, 2, 3].map((i) => cubeCard(`c${i}`, 0.1 * (i + 1), i));
    const res = await run({ mainboard } as any, [ref(mainboard[0]!), null, null], 'random', [1]);

    expect(res.status).toBe(200);
    expect(res.body.cards[0].details.name).toBe('c0');
    expect(res.body.cards[1]).not.toBeNull();
    expect(res.body.cards[2]).toBeNull();
  });

  it('replaces a listed slot that already has a card with a different card', async () => {
    const mainboard = [cubeCard('keep', 0.1, 0), cubeCard('old', 0.2, 1), cubeCard('new', 0.3, 2)];
    const res = await run({ mainboard } as any, [ref(mainboard[0]!), ref(mainboard[1]!)], 'random', [1]);

    expect(res.status).toBe(200);
    expect(res.body.cards.map((c: Card) => c.details!.name)).toEqual(['keep', 'new']);
  });

  it('balanced fill keeps the candidate whose best card is rated lowest', async () => {
    // Only one possible fill avoids the bomb, and ten candidates make missing it near-impossible.
    const mainboard = [cubeCard('low', 0.1, 0), cubeCard('low2', 0.15, 1), cubeCard('bomb', 0.99, 2)];
    const res = await run({ mainboard } as any, [ref(mainboard[0]!), null], 'balanced');

    expect(res.status).toBe(200);
    expect(res.body.cards.map((c: Card) => c.details!.name)).toEqual(['low', 'low2']);
  });

  it('resolves a by-name pick to an unused copy', async () => {
    const first = cubeCard('dup', 0.5, 0);
    const second = cubeCard('dup', 0.5, 1);
    const res = await run({ mainboard: [first, second] } as any, [ref(first), { name: 'Dup' }], 'score');

    expect(res.status).toBe(200);
    expect(res.body.cards.map((c: Card) => c.index)).toEqual([0, 1]);
  });

  it('rejects cards that are only on the maybeboard', async () => {
    const maybe = cubeCard('m', 0.5, 0, 'maybeboard');
    const res = await run({ mainboard: [], maybeboard: [maybe] } as any, [ref(maybe)], 'score');

    expect(res.status).toBe(400);
  });

  it('errors when the mainboard is too small to fill the pack', async () => {
    const res = await run({ mainboard: [cubeCard('a', 0.1, 0)] } as any, [null, null], 'random');

    expect(res.status).toBe(400);
  });
});
