jest.mock('serverutils/draftbots', () => ({
  batchDeckbuild: jest.fn(),
}));

// Keep setupPicks real (simple), but pin getCardDefaultRowColumn so layout is deterministic.
jest.mock('@utils/draftutil', () => {
  const actual = jest.requireActual('@utils/draftutil');
  return { ...actual, getCardDefaultRowColumn: jest.fn(() => ({ row: 0, col: 1 })) };
});

jest.mock('@utils/cardutil', () => ({
  isVoucher: jest.fn(() => false),
  cardOracleId: jest.fn((card: any) => card.oracle_id),
}));

import DraftType from '@utils/datatypes/Draft';
import { applyNaiveBotLayout, buildBotDecks } from 'serverutils/botDeckBuilder';
import { batchDeckbuild } from 'serverutils/draftbots';

const makeCard = (oracle: string) => ({ cardID: oracle, oracle_id: oracle, details: { oracle_id: oracle } });

// Seat 0 = human, seat 1 = bot with three picks (indices 0,1,2); index 3 is a basic.
const makeDraft = (): DraftType =>
  ({
    id: 'd1',
    cards: [makeCard('o0'), makeCard('o1'), makeCard('o2'), makeCard('basic')],
    basics: [3],
    seats: [
      { bot: false, pickorder: [0], mainboard: [], sideboard: [] },
      { bot: true, pickorder: [0, 1, 2], mainboard: [], sideboard: [] },
    ],
  }) as unknown as DraftType;

describe('applyNaiveBotLayout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lays out only bot seats by default row/col and never calls the ML service', () => {
    const draft = makeDraft();
    applyNaiveBotLayout(draft);

    // Bot seat: all three picks placed at the pinned (row 0, col 1) cell.
    expect(draft.seats[1]!.mainboard[0]![1]).toEqual([0, 1, 2]);
    // Human seat is left untouched.
    expect(draft.seats[0]!.mainboard).toEqual([]);
    expect(batchDeckbuild).not.toHaveBeenCalled();
  });
});

describe('buildBotDecks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('assembles ML results onto bot seats and sideboards the leftovers', async () => {
    const draft = makeDraft();
    (batchDeckbuild as jest.Mock).mockResolvedValue([{ mainboard: ['o0', 'o1'], sideboard: [] }]);

    await buildBotDecks(draft, { maxSpells: 23, maxLands: 17 });

    expect(batchDeckbuild).toHaveBeenCalledTimes(1);
    // ML picked o0 + o1 into the mainboard...
    expect(draft.seats[1]!.mainboard[0]![1]).toEqual([0, 1]);
    // ...leaving o2 (index 2, not a basic) in the sideboard.
    expect(draft.seats[1]!.sideboard[0]![1]).toEqual([2]);
  });

  it('does nothing (no ML call) when there are no bot seats', async () => {
    const draft = makeDraft();
    draft.seats = [draft.seats[0]!]; // human only

    await buildBotDecks(draft, { maxSpells: 23, maxLands: 17 });

    expect(batchDeckbuild).not.toHaveBeenCalled();
  });
});
