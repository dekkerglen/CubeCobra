import Card, { CardDetails } from '../../src/datatypes/Card';
import { Decklist } from '../../src/datatypes/Draftmancer';
import { getReasonableCardByOracle } from '../../src/util/carddb';
import { deckbuild } from '../../src/util/draftbots';
import { buildBotDeck, formatMainboard, formatSideboard, upsertCardAndGetIndex } from '../../src/util/draftmancerUtil';
import { getCardDefaultRowColumn } from '../../src/util/draftutil';
import { createCardDetails } from '../test-utils/data';

jest.mock('../../src/util/carddb', () => ({
  getReasonableCardByOracle: jest.fn(),
}));

jest.mock('../../src/util/draftbots', () => ({
  deckbuild: jest.fn(),
}));

//Not mocking cardutil.detailsToCard or draftutil.setupPicks as they are simple

jest.mock('../../src/util/draftutil', () => ({
  ...jest.requireActual('../../src/util/draftutil'),
  getCardDefaultRowColumn: jest.fn(),
}));

describe('upsertCardAndGetIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds new card to end of cards array and returns index', () => {
    const cards: CardDetails[] = [];
    cards.push(createCardDetails({ oracle_id: 'existing id' }));
    const oracleId = 'test-oracle-id';
    const mockCard = createCardDetails({ oracle_id: oracleId });

    (getReasonableCardByOracle as jest.Mock).mockReturnValue(mockCard);

    const result = upsertCardAndGetIndex(cards, oracleId);

    expect(result).toBe(1);
    expect(cards).toHaveLength(2);
    expect(cards[1]).toBe(mockCard);
  });

  it('returns existing card index without adding duplicate', () => {
    const oracleId = 'test-oracle-id';
    const existingCard = createCardDetails({ oracle_id: oracleId });
    const otherCard = createCardDetails({ oracle_id: 'other-id' });
    const cards = [existingCard, otherCard];

    const result = upsertCardAndGetIndex(cards, oracleId);

    expect(result).toBe(0);
    expect(cards).toHaveLength(2);
  });
});

describe('formatMainboard', () => {
  it('formats creature cards correctly', () => {
    const cards: CardDetails[] = [];
    const decklist: Decklist = {
      main: ['creature-id'],
      side: [],
      lands: { W: 0, U: 0, B: 0, R: 0, G: 0 },
    };

    const creatureCard = createCardDetails({
      oracle_id: 'creature-id',
      type: 'Creature',
      cmc: 2,
    });

    (getReasonableCardByOracle as jest.Mock).mockReturnValue(creatureCard);

    const result = formatMainboard(decklist, cards);

    // Creature should be in row 0, column 2 (based on CMC)
    expect(result[0][2]).toContain(0);
    expect(result[1][2]).toHaveLength(0);
  });

  it('formats non-creature cards correctly', () => {
    const cards: CardDetails[] = [];
    const decklist: Decklist = {
      main: ['instant-id'],
      side: [],
      lands: { W: 0, U: 0, B: 0, R: 0, G: 0 },
    };

    const instantCard = createCardDetails({
      oracle_id: 'instant-id',
      type: 'Instant',
      cmc: 3,
    });

    (getReasonableCardByOracle as jest.Mock).mockReturnValue(instantCard);

    const result = formatMainboard(decklist, cards);

    // Non-creature should be in row 1, column 3 (based on CMC)
    expect(result[0][3]).toHaveLength(0);
    expect(result[1][3]).toContain(0);
  });

  it('handles high CMC cards by capping column at 7', () => {
    const cards: CardDetails[] = [];
    const decklist: Decklist = {
      main: ['high-cmc-id'],
      side: [],
      lands: { W: 0, U: 0, B: 0, R: 0, G: 0 },
    };

    const highCMCCard = createCardDetails({
      oracle_id: 'high-cmc-id',
      type: 'Creature',
      cmc: 15,
    });

    (getReasonableCardByOracle as jest.Mock).mockReturnValue(highCMCCard);

    const result = formatMainboard(decklist, cards);

    expect(result[0][7]).toContain(0);
  });
});

describe('formatSideboard', () => {
  it('formats sideboard cards by CMC', () => {
    const cards: CardDetails[] = [];
    const decklist: Decklist = {
      main: [],
      side: ['side-card-id'],
      lands: { W: 0, U: 0, B: 0, R: 0, G: 0 },
    };

    const sideCard = createCardDetails({
      oracle_id: 'side-card-id',
      cmc: 2,
    });

    (getReasonableCardByOracle as jest.Mock).mockReturnValue(sideCard);

    const result = formatSideboard(decklist, cards);

    expect(result[0][2]).toContain(0);
  });

  it('caps sideboard card CMC at column 7', () => {
    const cards: CardDetails[] = [];
    const decklist: Decklist = {
      main: [],
      side: ['high-cmc-id'],
      lands: { W: 0, U: 0, B: 0, R: 0, G: 0 },
    };

    const highCMCCard = createCardDetails({
      oracle_id: 'high-cmc-id',
      cmc: 10,
    });

    (getReasonableCardByOracle as jest.Mock).mockReturnValue(highCMCCard);

    const result = formatSideboard(decklist, cards);

    expect(result[0][7]).toContain(0);
  });
});

describe('buildBotDeck', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getCardDefaultRowColumn as jest.Mock).mockImplementation((card: Card) => {
      if (card.details?.oracle_id.toLowerCase().includes('basic')) {
        return { row: 1, col: 0 };
      } else {
        const row = card.details?.type.toLowerCase().includes('creature') ? 0 : 1;
        return { row, col: card.cmc };
      }
    });
  });

  it('builds deck with correct mainboard and sideboard', () => {
    const pickorder = [0, 1, 3];
    const basics = [2, 4];
    const cards = [
      createCardDetails({ oracle_id: 'card-1', type: 'Creature', cmc: 2 }),
      createCardDetails({ oracle_id: 'card-2', type: 'Instant', cmc: 3 }),
      createCardDetails({ oracle_id: 'basic-1', type: 'Basic Land' }),
      createCardDetails({ oracle_id: 'card-3', type: 'Creature', cmc: 4 }),
      createCardDetails({ oracle_id: 'basic-2', type: 'Basic Land' }),
    ];

    (deckbuild as jest.Mock).mockReturnValue({
      mainboard: ['card-1', 'card-2', 'basic-1'],
    });

    const result = buildBotDeck(pickorder, basics, cards);

    expect(deckbuild).toHaveBeenCalledWith([cards[0], cards[1], cards[3]], [cards[2], cards[4]]);

    // Verify mainboard formatting
    expect(result.mainboard[0][2]).toContain(0); // creature in row 0
    expect(result.mainboard[1][3]).toContain(1); // instant in row 1
    expect(result.mainboard[1][0]).toContain(2); // basic land in row 1, col 0

    // Verify remaining card went to sideboard
    expect(result.sideboard[0][4]).toContain(3); // card-3 in sideboard
  });

  it('handles missing cards gracefully', () => {
    const pickorder = [0];
    const basics = [1];
    const cards = [
      createCardDetails({ oracle_id: 'card-1', type: 'Creature', cmc: 2 }),
      createCardDetails({ oracle_id: 'basic-1', type: 'Basic Land' }),
    ];

    (deckbuild as jest.Mock).mockReturnValue({
      mainboard: ['missing-card'],
    });

    const result = buildBotDeck(pickorder, basics, cards);

    // Should have empty mainboard since card wasn't found
    expect(result.mainboard.flat(2)).toHaveLength(0);
    // Original card should be in sideboard
    expect(result.sideboard[0][2]).toContain(0);
  });
});
