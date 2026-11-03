import { CubeCards } from '@utils/datatypes/Cube';

// Record decks are submitted as oracle ids, so each printing has to be recovered from the
// cube. The type line and mana value here decide which row and column a card lands in.
const DETAILS: Record<string, any> = {
  'bolt-cube': { scryfall_id: 'bolt-cube', oracle_id: 'bolt-oracle', type: 'Instant', cmc: 1 },
  'bear-cube': { scryfall_id: 'bear-cube', oracle_id: 'bear-oracle', type: 'Creature — Bear', cmc: 2 },
  'titan-cube': { scryfall_id: 'titan-cube', oracle_id: 'titan-oracle', type: 'Creature — Giant', cmc: 12 },
  'bolt-default': { scryfall_id: 'bolt-default', oracle_id: 'bolt-oracle', type: 'Instant', cmc: 1 },
};

jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn((id: string) => DETAILS[id] ?? { scryfall_id: id, oracle_id: '', type: '', cmc: 0 }),
  getReasonableCardByOracle: jest.fn(() => DETAILS['bolt-default']),
  getVersionsByOracleId: jest.fn(() => []),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn(), getCards: jest.fn(), update: jest.fn() },
  draftDao: { getById: jest.fn(), createDraft: jest.fn(), update: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
  userDao: { getByUsername: jest.fn() },
}));

import { cubeDao, draftDao } from '../../../src/dynamo/daos';
import { associateDecksWithExistingDraft } from '../../../src/router/routes/cube/records/uploaddeck';
import { createCube } from '../../test-utils/data';

const cubeCards = (): CubeCards =>
  ({
    mainboard: [
      { cardID: 'bolt-cube', board: 'mainboard', index: 0, details: DETAILS['bolt-cube'] },
      { cardID: 'bear-cube', board: 'mainboard', index: 1, details: DETAILS['bear-cube'] },
      { cardID: 'titan-cube', board: 'mainboard', index: 2, details: DETAILS['titan-cube'] },
    ],
    maybeboard: [],
    basics: [],
  }) as unknown as CubeCards;

const emptyMainboard = () => Array.from({ length: 2 }, () => Array.from({ length: 8 }, () => [] as number[]));
const emptySideboard = () => [Array.from({ length: 8 }, () => [] as number[])];

// A draft that already exists, with `seatCount` empty seats.
const existingDraft = (seatCount = 3) =>
  ({
    id: 'draft-1',
    cube: 'cube-1',
    cards: [] as any[],
    seats: Array.from({ length: seatCount }, (_, idx) => ({
      owner: undefined,
      title: `Seat ${idx + 1}`,
      mainboard: emptyMainboard(),
      sideboard: emptySideboard(),
    })),
  }) as any;

// The cards a seat's pool resolved to, in pool order.
const poolCards = (draft: any, pool: number[][][]) => pool.flat(3).map((index: number) => draft.cards[index]);

describe('associateDecksWithExistingDraft', () => {
  const cube = createCube({ id: 'cube-1' });

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getCards as jest.Mock).mockResolvedValue(cubeCards());
  });

  it('loads the cube pool once and updates the draft once for three seats', async () => {
    const draft = existingDraft(3);

    await associateDecksWithExistingDraft(cube, draft, {
      1: { mainboard: ['bolt-oracle'] },
      2: { mainboard: ['bear-oracle'] },
      3: { mainboard: ['titan-oracle'] },
    });

    expect(cubeDao.getCards).toHaveBeenCalledTimes(1);
    expect(draftDao.update).toHaveBeenCalledTimes(1);
    expect(draftDao.update).toHaveBeenCalledWith(draft);

    expect(poolCards(draft, draft.seats[0].mainboard)).toEqual([expect.objectContaining({ cardID: 'bolt-cube' })]);
    expect(poolCards(draft, draft.seats[1].mainboard)).toEqual([expect.objectContaining({ cardID: 'bear-cube' })]);
    expect(poolCards(draft, draft.seats[2].mainboard)).toEqual([expect.objectContaining({ cardID: 'titan-cube' })]);

    // Every seat's cards share one card list, so the indices must not collide.
    expect(draft.cards).toHaveLength(3);
    // Non-creatures on row 1, creatures on row 0; column is mana value clamped to 0-7.
    expect(draft.seats[0].mainboard[1][1]).toEqual([0]);
    expect(draft.seats[1].mainboard[0][2]).toEqual([1]);
    expect(draft.seats[2].mainboard[0][7]).toEqual([2]);
  });

  it('leaves seats absent from decksByIndex untouched', async () => {
    const draft = existingDraft(3);
    // Seat 3 already holds a deck from an earlier upload.
    draft.cards.push({ cardID: 'already-here', details: DETAILS['bolt-cube'] });
    const untouchedPool = draft.seats[2].mainboard;
    untouchedPool[1][1].push(0);
    const untouchedSideboard = draft.seats[2].sideboard;

    await associateDecksWithExistingDraft(cube, draft, { 1: { mainboard: ['bolt-oracle'] } });

    expect(draft.seats[2].mainboard).toBe(untouchedPool);
    expect(draft.seats[2].mainboard[1][1]).toEqual([0]);
    expect(draft.seats[2].sideboard).toBe(untouchedSideboard);
    expect(draft.seats[1].mainboard.flat(3)).toEqual([]);
    // The submitted seat's card appends after the existing one rather than replacing it.
    expect(draft.cards).toHaveLength(2);
    expect(poolCards(draft, draft.seats[0].mainboard)).toEqual([expect.objectContaining({ cardID: 'bolt-cube' })]);
  });

  it('resets a seat given an empty mainboard', async () => {
    const draft = existingDraft(2);
    draft.cards.push({ cardID: 'already-here', details: DETAILS['bolt-cube'] });
    draft.seats[0].mainboard[1][1].push(0);
    draft.seats[0].sideboard[0][1].push(0);

    await associateDecksWithExistingDraft(cube, draft, { 1: { mainboard: [] } });

    expect(draft.seats[0].mainboard.flat(3)).toEqual([]);
    expect(draft.seats[0].sideboard.flat(3)).toEqual([]);
    expect(draftDao.update).toHaveBeenCalledTimes(1);
  });

  it('places sideboard oracles on the sideboard pool', async () => {
    const draft = existingDraft(2);

    await associateDecksWithExistingDraft(cube, draft, {
      2: { mainboard: ['bolt-oracle'], sideboard: ['bear-oracle', 'titan-oracle'] },
    });

    expect(poolCards(draft, draft.seats[1].mainboard)).toEqual([expect.objectContaining({ cardID: 'bolt-cube' })]);
    expect(poolCards(draft, draft.seats[1].sideboard)).toEqual([
      expect.objectContaining({ cardID: 'bear-cube' }),
      expect.objectContaining({ cardID: 'titan-cube' }),
    ]);
    // The sideboard is a single row, so creatures and non-creatures alike sit on row 0.
    expect(draft.seats[1].sideboard[0][2]).toEqual([1]);
    expect(draft.seats[1].sideboard[0][7]).toEqual([2]);
  });

  it('uses preloadedCubeCards instead of calling cubeDao.getCards', async () => {
    const draft = existingDraft(1);

    await associateDecksWithExistingDraft(cube, draft, { 1: { mainboard: ['bear-oracle'] } }, cubeCards());

    expect(cubeDao.getCards).not.toHaveBeenCalled();
    expect(poolCards(draft, draft.seats[0].mainboard)).toEqual([expect.objectContaining({ cardID: 'bear-cube' })]);
  });

  it('ignores an index beyond the seat count', async () => {
    const draft = existingDraft(2);

    await associateDecksWithExistingDraft(cube, draft, {
      1: { mainboard: ['bolt-oracle'] },
      9: { mainboard: ['bear-oracle'] },
    });

    // The missing seat's cards must not be resolved into the shared card list either,
    // or they would sit in draft.cards with nothing pointing at them.
    expect(draft.cards).toHaveLength(1);
    expect(poolCards(draft, draft.seats[0].mainboard)).toEqual([expect.objectContaining({ cardID: 'bolt-cube' })]);
    expect(draftDao.update).toHaveBeenCalledTimes(1);
  });
});
