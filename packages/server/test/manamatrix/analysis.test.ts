import { Catalog } from '@utils/datatypes/CardCatalog';

// Built inside the factory: @swc/jest hoists jest.mock above module-scope
// declarations, so an outer const would be in the TDZ when the factory runs.
jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: {
    imagedict: {},
    cardimages: {},
    cardnames: [],
    comboTree: {},
    full_names: [],
    nameToId: {},
    oracleToId: {},
    english: {},
    _carddict: {},
    indexToOracle: [],
    oracleToIndex: {},
    metadatadict: {},
    printedCardList: [],
    printedCardListWithExtras: [],
    comboOracleToIndex: {},
    reasonable_names: [],
    reasonable_full_names: [],
    setdict: {},
  },
  whenCardDbReady: () => Promise.resolve(),
  isCardDbReady: () => true,
}));

import { CardDetails } from '@utils/datatypes/Card';
import { ManaMatrixCellStats, ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';
import cardCatalog from 'serverutils/cardCatalog';
import { clearPrintingIndexCache } from 'serverutils/cardPrintings';
import { analyzePuzzle, clearAnalysisCache } from 'serverutils/manamatrix/analysis';
import { clearCompiledFilterCache } from 'serverutils/manamatrix/validate';

import { createCardDetails } from '../test-utils/data';

const mockCardCatalog = cardCatalog as unknown as Catalog;

const normalDetails: Partial<CardDetails> = {
  isExtra: false,
  isToken: false,
  promo: false,
  digital: false,
  layout: 'normal',
  language: 'en',
  set_type: 'expansion',
};

let puzzleCounter = 0;
const createPuzzle = (columns: string[], rows: string[]): ManaMatrixPuzzle => {
  puzzleCounter += 1;
  const date = `2026-02-${String(puzzleCounter).padStart(2, '0')}`;
  return {
    id: date,
    type: 'HISTORY',
    date,
    columns: columns.map((filterText) => ({ filterText, description: filterText })),
    rows: rows.map((filterText) => ({ filterText, description: filterText })),
    counts: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    isActive: true,
    dateCreated: 0,
    dateLastUpdated: 0,
  };
};

const noStats = (): (ManaMatrixCellStats | undefined)[][] =>
  Array.from({ length: 3 }, () => [undefined, undefined, undefined]);

const statsFor = (answerCounts: Record<string, number>, totalAnswers: number): ManaMatrixCellStats => ({
  date: 'x',
  row: 0,
  col: 0,
  totalAnswers,
  answerCounts,
  dateCreated: 0,
  dateLastUpdated: 0,
});

// One card, two names: The Great Henge premiered in Throne of Eldraine and came
// back as "Party Tree" in a Secret Lair. Both printings satisfy the cell below.
const HENGE_ORACLE = 'great-henge-oracle';
const seedHenge = () => {
  mockCardCatalog.printedCardList = [
    createCardDetails({
      ...normalDetails,
      name: 'Party Tree',
      name_lower: 'party tree',
      oracle_id: HENGE_ORACLE,
      scryfall_id: 'henge-reskin',
      set: 'sld',
      setIndex: 9,
      reprint: true,
      type: 'Legendary Artifact',
      cmc: 9,
    }),
    createCardDetails({
      ...normalDetails,
      name: 'The Great Henge',
      name_lower: 'the great henge',
      oracle_id: HENGE_ORACLE,
      scryfall_id: 'henge-original',
      set: 'eld',
      setIndex: 2,
      reprint: false,
      type: 'Legendary Artifact',
      cmc: 9,
    }),
  ];
};

describe('analyzePuzzle', () => {
  beforeEach(() => {
    clearAnalysisCache();
    clearCompiledFilterCache();
    clearPrintingIndexCache();
    mockCardCatalog.printedCardList = [];
  });

  it('lists a reskinned card once, under its real name', () => {
    seedHenge();
    const puzzle = createPuzzle(['type:artifact', 'cmc=0', 'cmc=0'], ['cmc=9', 'cmc=0', 'cmc=0']);

    const cell = analyzePuzzle(puzzle, noStats())[0]![0]!;
    // Before canonicalisation this cell listed two cards, one of them a name no
    // player would recognise as the card it belongs to.
    expect(cell.validCards.map((entry) => entry.name)).toEqual(['The Great Henge']);
    expect(cell.totalCards).toBe(1);
  });

  it('counts guesses filed under either name towards the one card', () => {
    seedHenge();
    const puzzle = createPuzzle(['type:artifact', 'cmc=0', 'cmc=0'], ['cmc=9', 'cmc=0', 'cmc=0']);
    const cellStats = noStats();
    // Tallies recorded before validateAnswers canonicalised its keys can name the
    // reskin; they are still guesses for the same card.
    cellStats[0]![0] = statsFor({ 'party tree': 2, 'the great henge': 3 }, 5);

    const cell = analyzePuzzle(puzzle, cellStats)[0]![0]!;
    expect(cell.validCards).toEqual([{ name: 'The Great Henge', guesses: 5, percentage: 100 }]);
  });

  it('still sorts most-guessed first, then alphabetically', () => {
    mockCardCatalog.printedCardList = [
      createCardDetails({ ...normalDetails, name: 'Aaa Card', name_lower: 'aaa card', type: 'Artifact', cmc: 9 }),
      createCardDetails({ ...normalDetails, name: 'Bbb Card', name_lower: 'bbb card', type: 'Artifact', cmc: 9 }),
      createCardDetails({ ...normalDetails, name: 'Ccc Card', name_lower: 'ccc card', type: 'Artifact', cmc: 9 }),
    ];
    const puzzle = createPuzzle(['type:artifact', 'cmc=0', 'cmc=0'], ['cmc=9', 'cmc=0', 'cmc=0']);
    const cellStats = noStats();
    cellStats[0]![0] = statsFor({ 'ccc card': 4 }, 4);

    const cell = analyzePuzzle(puzzle, cellStats)[0]![0]!;
    expect(cell.validCards.map((entry) => entry.name)).toEqual(['Ccc Card', 'Aaa Card', 'Bbb Card']);
    expect(cell.totalGuesses).toBe(4);
  });
});
