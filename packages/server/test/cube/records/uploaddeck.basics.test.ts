import { CubeCards } from '@utils/datatypes/Cube';

// Record decks are submitted as oracle ids, so the printing has to be recovered from the
// cube. These tests pin which printing each oracle resolves to.
const DETAILS: Record<string, any> = {
  'bolt-cube': { scryfall_id: 'bolt-cube', oracle_id: 'bolt-oracle', type: 'Instant', cmc: 1 },
  'bolt-default': { scryfall_id: 'bolt-default', oracle_id: 'bolt-oracle', type: 'Instant', cmc: 1 },
  'island-cube': { scryfall_id: 'island-cube', oracle_id: 'island-oracle', type: 'Basic Land — Island', cmc: 0 },
  'island-default': { scryfall_id: 'island-default', oracle_id: 'island-oracle', type: 'Basic Land — Island', cmc: 0 },
};

jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn((id: string) => DETAILS[id] ?? { scryfall_id: id, oracle_id: '', type: '', cmc: 0 }),
  // The catalog's default printing — what a basic land used to fall through to.
  getReasonableCardByOracle: jest.fn((oracle: string) =>
    oracle === 'island-oracle' ? DETAILS['island-default'] : DETAILS['bolt-default'],
  ),
  getVersionsByOracleId: jest.fn(() => []),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn(), getCards: jest.fn(), update: jest.fn() },
  draftDao: { getById: jest.fn(), createDraft: jest.fn(), update: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
  userDao: { getByUsername: jest.fn() },
}));

import { cubeDao, draftDao } from '../../../src/dynamo/daos';
import { associateDecksWithNewDraft, associateNewDraft } from '../../../src/router/routes/cube/records/uploaddeck';
import { createCube } from '../../test-utils/data';

const cubeCards = (basicsBoardKey = 'basics'): CubeCards =>
  ({
    mainboard: [{ cardID: 'bolt-cube', board: 'mainboard', index: 0, details: DETAILS['bolt-cube'] }],
    maybeboard: [],
    [basicsBoardKey]: [
      {
        cardID: 'island-cube',
        board: basicsBoardKey,
        index: 0,
        imgUrl: 'https://example.com/island.png',
        finish: 'Foil',
        details: DETAILS['island-cube'],
      },
    ],
  }) as unknown as CubeCards;

const record = () => ({ id: 'rec', cube: 'cube-1', date: 1, players: [{ name: 'Alice' }] }) as any;

// The cards a seat's deck resolved to, in pool order.
const seatCards = (draft: any, seatIndex = 0) =>
  draft.seats[seatIndex].mainboard.flat(3).map((index: number) => draft.cards[index]);

describe('record deck uploads resolve basics from the cube', () => {
  let created: any;

  beforeEach(() => {
    jest.clearAllMocks();
    created = undefined;
    (draftDao.createDraft as jest.Mock).mockImplementation(async (draft: any) => {
      created = draft;
      return 'new-draft';
    });
  });

  it('keeps the basics board printing and custom image instead of the catalog default', async () => {
    const cube = createCube({ id: 'cube-1' });
    (cubeDao.getCards as jest.Mock).mockResolvedValue(cubeCards());

    await associateNewDraft(cube, record(), 1, ['bolt-oracle', 'island-oracle'], []);

    // Seat pools are laid out by mana value, not decklist order.
    const byId = Object.fromEntries(seatCards(created).map((card: any) => [card.cardID, card]));
    expect(Object.keys(byId).sort()).toEqual(['bolt-cube', 'island-cube']);
    expect(byId['island-cube']).toEqual(
      expect.objectContaining({ imgUrl: 'https://example.com/island.png', finish: 'Foil' }),
    );
  });

  it('honors a renamed basics board', async () => {
    const cube = createCube({ id: 'cube-1', basicsBoard: 'My Lands' });
    (cubeDao.getCards as jest.Mock).mockResolvedValue(cubeCards('mylands'));

    await associateNewDraft(cube, record(), 1, ['island-oracle'], []);

    expect(seatCards(created)[0]).toEqual(expect.objectContaining({ cardID: 'island-cube' }));
  });

  it('falls back to the catalog printing when the cube opted out of basics', async () => {
    const cube = createCube({ id: 'cube-1', basicsBoard: 'None' });
    (cubeDao.getCards as jest.Mock).mockResolvedValue(cubeCards());

    await associateNewDraft(cube, record(), 1, ['island-oracle'], []);

    expect(seatCards(created)[0]).toEqual(expect.objectContaining({ cardID: 'island-default' }));
    expect(created.basics).toEqual([]);
  });

  it('resolves sideboard basics too', async () => {
    const cube = createCube({ id: 'cube-1' });
    (cubeDao.getCards as jest.Mock).mockResolvedValue(cubeCards());

    await associateNewDraft(cube, record(), 1, ['bolt-oracle'], ['island-oracle']);

    const sideboardCards = created.seats[0].sideboard.flat(3).map((index: number) => created.cards[index]);
    expect(sideboardCards[0]).toEqual(expect.objectContaining({ cardID: 'island-cube' }));
  });

  it('resolves basics in the batched multi-deck import', async () => {
    const cube = createCube({ id: 'cube-1' });
    (cubeDao.getCards as jest.Mock).mockResolvedValue(cubeCards());

    await associateDecksWithNewDraft(cube, record(), { 1: { mainboard: ['island-oracle'] } });

    expect(seatCards(created)[0]).toEqual(expect.objectContaining({ cardID: 'island-cube' }));
  });
});
