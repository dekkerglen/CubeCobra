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
import { ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';
import cardCatalog from 'serverutils/cardCatalog';
import { clearCompiledFilterCache, validateAnswers } from 'serverutils/manamatrix/validate';

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

const seedCard = (details: CardDetails) => {
  mockCardCatalog._carddict[details.scryfall_id] = details;
  const nameKey = details.name_lower;
  mockCardCatalog.nameToId[nameKey] = [...(mockCardCatalog.nameToId[nameKey] ?? []), details.scryfall_id];
  mockCardCatalog.oracleToId[details.oracle_id] = [
    ...(mockCardCatalog.oracleToId[details.oracle_id] ?? []),
    details.scryfall_id,
  ];
};

let puzzleCounter = 0;
const createPuzzle = (columns: string[], rows: string[]): ManaMatrixPuzzle => {
  puzzleCounter += 1;
  const date = `2026-01-${String(puzzleCounter).padStart(2, '0')}`;
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

const emptyAnswers = (): (string | null)[][] => [
  [null, null, null],
  [null, null, null],
  [null, null, null],
];

describe('validateAnswers', () => {
  beforeEach(() => {
    clearCompiledFilterCache();
    mockCardCatalog._carddict = {};
    mockCardCatalog.nameToId = {};
    mockCardCatalog.oracleToId = {};
  });

  it('accepts an answer when one printing satisfies both filters', () => {
    seedCard(
      createCardDetails({
        ...normalDetails,
        name: 'Grizzly Bears',
        name_lower: 'grizzly bears',
        set: 'lea',
        type: 'Creature — Bear',
        cmc: 2,
        power: '2',
        toughness: '2',
      }),
    );

    const puzzle = createPuzzle(['set:lea', 'cmc=0', 'cmc=0'], ['type:creature', 'cmc=0', 'cmc=0']);
    const answers = emptyAnswers();
    answers[0]![0] = 'Grizzly Bears';

    const result = validateAnswers(puzzle, answers);
    expect(result.correct[0]![0]).toBe(true);
    expect(result.matchedNames[0]![0]).toBe('grizzly bears');
  });

  it('rejects an answer when only different printings satisfy each filter', () => {
    const oracleId = 'shared-oracle-id';
    // Printing A: in set aaa, common. Printing B: in set bbb, mythic.
    seedCard(
      createCardDetails({
        ...normalDetails,
        name: 'Split Printing',
        name_lower: 'split printing',
        oracle_id: oracleId,
        scryfall_id: 'printing-a',
        set: 'aaa',
        rarity: 'common',
        type: 'Creature — Test',
      }),
    );
    seedCard(
      createCardDetails({
        ...normalDetails,
        name: 'Split Printing',
        name_lower: 'split printing',
        oracle_id: oracleId,
        scryfall_id: 'printing-b',
        set: 'bbb',
        rarity: 'mythic',
        type: 'Creature — Test',
      }),
    );

    // set:aaa matches only printing A; r:mythic matches only printing B. No
    // single printing passes both, so the answer must be wrong.
    const mismatchPuzzle = createPuzzle(['set:aaa', 'cmc=0', 'cmc=0'], ['r:mythic', 'cmc=0', 'cmc=0']);
    const answers = emptyAnswers();
    answers[0]![0] = 'Split Printing';
    expect(validateAnswers(mismatchPuzzle, answers).correct[0]![0]).toBe(false);

    // But the same card IS valid where a single printing passes both filters.
    const matchPuzzle = createPuzzle(['set:bbb', 'cmc=0', 'cmc=0'], ['r:mythic', 'cmc=0', 'cmc=0']);
    expect(validateAnswers(matchPuzzle, answers).correct[0]![0]).toBe(true);
  });

  it('ignores extra printings (tokens, digital) entirely', () => {
    seedCard(
      createCardDetails({
        ...normalDetails,
        name: 'Digital Only',
        name_lower: 'digital only',
        digital: true,
        set: 'digset',
        type: 'Creature — Test',
      }),
    );

    const puzzle = createPuzzle(['set:digset', 'cmc=0', 'cmc=0'], ['type:creature', 'cmc=0', 'cmc=0']);
    const answers = emptyAnswers();
    answers[0]![0] = 'Digital Only';

    expect(validateAnswers(puzzle, answers).correct[0]![0]).toBe(false);
  });

  it('resolves names case-insensitively and ignores accents', () => {
    seedCard(
      createCardDetails({
        ...normalDetails,
        name: 'Déjà Vu',
        // nameToId keys are normalized (lowercased, accents stripped).
        name_lower: 'deja vu',
        set: 'tst',
        type: 'Sorcery',
      }),
    );

    const puzzle = createPuzzle(['set:tst', 'cmc=0', 'cmc=0'], ['type:sorcery', 'cmc=0', 'cmc=0']);
    const answers = emptyAnswers();
    answers[0]![0] = 'DÉJÀ vu';

    expect(validateAnswers(puzzle, answers).correct[0]![0]).toBe(true);
  });

  it('leaves empty and unknown answers incorrect', () => {
    const puzzle = createPuzzle(['cmc=0', 'cmc=0', 'cmc=0'], ['cmc=0', 'cmc=0', 'cmc=0']);
    const answers = emptyAnswers();
    answers[1]![1] = 'Not A Real Card';
    answers[2]![2] = '   ';

    const result = validateAnswers(puzzle, answers);
    expect(result.correct.flat().every((cell) => cell === false)).toBe(true);
    expect(result.matchedNames.flat().every((name) => name === null)).toBe(true);
  });
});
