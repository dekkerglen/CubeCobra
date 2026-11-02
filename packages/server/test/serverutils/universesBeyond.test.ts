import { Catalog } from '@utils/datatypes/CardCatalog';

// Built inside the factory: @swc/jest hoists jest.mock above module-scope declarations.
jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: {
    _carddict: {},
    oracleToId: {},
    printedCardList: [],
    printedCardListWithExtras: [],
    indexToOracle: [],
    metadatadict: {},
  },
}));

import { CardDetails, PrintingPreference } from '@utils/datatypes/Card';
import { FilterFunction } from '@utils/filtering/FilterCards';
import { getAllMostReasonable, getRelatedCards } from 'serverutils/carddb';
import cardCatalog from 'serverutils/cardCatalog';
import { excludeUniversesBeyond, hidesUniversesBeyond } from 'serverutils/universesBeyond';

import { createCardDetails } from '../test-utils/data';

const mockCardCatalog = cardCatalog as unknown as Catalog;

const printing = (oracle: string, id: string, ub: boolean, overrides: Partial<CardDetails> = {}): CardDetails =>
  createCardDetails({
    name: oracle,
    oracle_id: oracle,
    scryfall_id: id,
    released_at: '2020/01/01',
    isExtra: false,
    promo: false,
    digital: false,
    isToken: false,
    border_color: 'black',
    language: 'en',
    layout: 'normal',
    promo_types: ub ? ['universesbeyond'] : undefined,
    ...overrides,
  });

// A card with only a UB printing, and one with both (whose UB printing is the default).
const ubOnly = printing('ub-only', 'ub-only-1', true);
const mixedUb = printing('mixed', 'mixed-ub', true, { isDefault: true, released_at: '2024/01/01' });
const mixedRegular = printing('mixed', 'mixed-regular', false);
const regular = printing('regular', 'regular-1', false);

const fillCatalog = (cards: CardDetails[]) => {
  mockCardCatalog._carddict = {};
  mockCardCatalog.oracleToId = {};
  mockCardCatalog.printedCardList = [];
  for (const card of cards) {
    mockCardCatalog._carddict[card.scryfall_id] = card;
    (mockCardCatalog.oracleToId[card.oracle_id] ??= []).push(card.scryfall_id);
    mockCardCatalog.printedCardList.push(card);
  }
};

const everything = Object.assign(() => true, { fieldsUsed: [], stringify: '' }) as FilterFunction;

describe('hidesUniversesBeyond', () => {
  const user = { hideUniversesBeyond: true };

  it('follows the setting, but steps aside for a query that asks for UB cards', () => {
    expect(hidesUniversesBeyond(undefined, 't:creature')).toBe(false);
    expect(hidesUniversesBeyond({ hideUniversesBeyond: false }, 't:creature')).toBe(false);
    expect(hidesUniversesBeyond(user, 't:creature')).toBe(true);
    expect(hidesUniversesBeyond(user, 'is:ub')).toBe(false);
    expect(hidesUniversesBeyond(user, 't:creature (has:UniversesBeyond)')).toBe(false);
    // Negated, the query already excludes UB.
    expect(hidesUniversesBeyond(user, '-is:ub')).toBe(true);
  });
});

describe('excluding Universes Beyond from search', () => {
  beforeEach(() => fillCatalog([ubOnly, mixedUb, mixedRegular, regular]));

  it('drops UB-only cards and shows mixed cards in a regular printing', () => {
    const results = getAllMostReasonable(excludeUniversesBeyond(everything), PrintingPreference.DEFAULT, false, true);

    expect(results.map((card) => card.scryfall_id).sort()).toEqual(['mixed-regular', 'regular-1']);
  });

  it('treats an empty query as everything but UB, and keeps the query visible to callers', () => {
    expect(excludeUniversesBeyond(null)({ details: ubOnly } as any)).toBe(false);

    const setFilter = Object.assign(() => true, { fieldsUsed: ['set'], stringify: 'set:abc' }) as FilterFunction;
    const wrapped = excludeUniversesBeyond(setFilter);
    expect(wrapped.fieldsUsed).toEqual(['set']);
    expect(wrapped.stringify).toBe('set:abc');
  });
});

describe('getRelatedCards with Universes Beyond hidden', () => {
  it('drops UB-only related cards and shows the rest in a regular printing', () => {
    fillCatalog([ubOnly, mixedUb, mixedRegular, regular]);
    mockCardCatalog.indexToOracle = ['ub-only', 'mixed', 'regular'];
    const bucket = { top: [0, 1, 2], creatures: [], spells: [], other: [] };
    mockCardCatalog.metadatadict = {
      seed: { cubedWith: bucket, draftedWith: bucket, synergistic: bucket, elo: 0, popularity: 0, cubes: 0, picks: 0 },
    } as any;

    const shown = getRelatedCards('seed', PrintingPreference.DEFAULT, false).synergistic!.top!;
    const hidden = getRelatedCards('seed', PrintingPreference.DEFAULT, true).synergistic!.top!;

    expect(shown.map((card) => card.scryfall_id)).toEqual(['ub-only-1', 'mixed-ub', 'regular-1']);
    expect(hidden.map((card) => card.scryfall_id)).toEqual(['mixed-regular', 'regular-1']);
  });
});
