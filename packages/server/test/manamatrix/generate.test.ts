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

import { makeFilter } from '@utils/filtering/FilterCards';
import seedrandom from 'seedrandom';
import cardCatalog from 'serverutils/cardCatalog';
import {
  enumerateAllCategoryTexts,
  generateCategoryTexts,
  generatePuzzle,
  GeneratorPools,
} from 'serverutils/manamatrix/generate';

const mockCardCatalog = cardCatalog as unknown as Catalog;

const POOLS: GeneratorPools = {
  sets: ['thb', 'mh3', 'blb'],
  oracleTags: ['removal', 'board-wipe', 'card-advantage'],
  artTags: ['squirrel', 'sunset', 'skeleton'],
};

describe('enumerateAllCategoryTexts', () => {
  it('every possible category filter text parses unambiguously', () => {
    const texts = enumerateAllCategoryTexts(POOLS);
    expect(texts.length).toBeGreaterThan(100);

    for (const text of texts) {
      const { err, filter } = makeFilter(text);
      // err is falsy only when the text parsed with exactly one result.
      expect({ text, err }).toEqual({ text, err: false });
      expect(filter).not.toBeNull();
    }
  });
});

describe('generateCategoryTexts', () => {
  it('is deterministic for a given seed', () => {
    const first = generateCategoryTexts(seedrandom('2026-09-24'), POOLS);
    const second = generateCategoryTexts(seedrandom('2026-09-24'), POOLS);
    expect(first).toEqual(second);
    expect(first).toHaveLength(6);
  });

  it('produces different categories for different seeds', () => {
    const first = generateCategoryTexts(seedrandom('2026-09-24'), POOLS);
    const second = generateCategoryTexts(seedrandom('2026-09-25'), POOLS);
    expect(first).not.toEqual(second);
  });

  it('never emits tag or set categories when those pools are empty', () => {
    const rng = seedrandom('any-seed');
    for (let i = 0; i < 50; i++) {
      const texts = generateCategoryTexts(rng, { sets: [], oracleTags: [], artTags: [] });
      for (const text of texts) {
        expect(text).not.toMatch(/^(set:|otag:|atag:)/);
      }
    }
  });
});

describe('generatePuzzle', () => {
  it('gives up after a bounded number of attempts when no cell can be filled', () => {
    // Empty catalog: every cell count is 0, so every attempt fails.
    mockCardCatalog.printedCardList = [];
    expect(() => generatePuzzle('2026-09-24')).toThrow(/within 30 attempts/);
  });
});
