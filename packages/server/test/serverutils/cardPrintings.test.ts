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
import SetInfo from '@utils/datatypes/SetInfo';
import cardCatalog from 'serverutils/cardCatalog';
import {
  canonicalCardName,
  canonicalPrintingForName,
  clearPrintingIndexCache,
  excludedSets,
  isEarlierPrinting,
  originalPrintings,
  printingsInScope,
  setsWithFirstPrinting,
} from 'serverutils/cardPrintings';
import { eligiblePremiereSetCodes, eligibleSetCodes } from 'serverutils/setEligibility';

import { createCardDetails } from '../test-utils/data';

const mockCardCatalog = cardCatalog as unknown as Catalog;

// A real game piece: nothing here trips isExtraCard.
const playable: Partial<CardDetails> = {
  isExtra: false,
  isToken: false,
  digital: false,
  layout: 'normal',
  language: 'en',
  set_type: 'expansion',
};

const printing = (name: string, overrides: Partial<CardDetails> = {}): CardDetails =>
  createCardDetails({
    ...playable,
    name,
    name_lower: name.toLowerCase(),
    type: 'Creature — Human',
    ...overrides,
  });

const setInfo = (overrides: Partial<SetInfo> = {}): SetInfo => ({
  code: 'xxx',
  name: 'Some Set',
  setType: 'expansion',
  releasedAt: '2020-01-01',
  cardCount: 300,
  digital: false,
  icon: '',
  ...overrides,
});

/**
 * The Great Henge premiered in Throne of Eldraine and came back as "Party Tree" in
 * a later Secret Lair: one oracle id, two names, and the second one is a costume.
 */
const GREAT_HENGE_ORACLE = 'great-henge-oracle';
const reskinnedCard = (): CardDetails[] => [
  // Deliberately reskin-first, because printedCardList is not ordered oldest-first
  // and taking the first printing seen is exactly the bug.
  printing('Party Tree', {
    oracle_id: GREAT_HENGE_ORACLE,
    set: 'sld',
    setIndex: 9,
    released_at: '2023-06-01',
    reprint: true,
  }),
  printing('The Great Henge', {
    oracle_id: GREAT_HENGE_ORACLE,
    set: 'eld',
    setIndex: 2,
    released_at: '2019-10-04',
    reprint: false,
  }),
];

beforeEach(() => {
  mockCardCatalog.printedCardList = [];
  mockCardCatalog.setdict = {};
  clearPrintingIndexCache();
});

afterEach(() => {
  clearPrintingIndexCache();
});

describe('isEarlierPrinting', () => {
  const base = printing('Anything', { reprint: true, setIndex: 5, released_at: '2010-01-01' });

  it('prefers a non-reprint over any reprint, however old', () => {
    const original = { ...base, reprint: false, setIndex: 99, released_at: '2024-01-01' };
    expect(isEarlierPrinting(original, base)).toBe(true);
    expect(isEarlierPrinting(base, original)).toBe(false);
  });

  it('falls back to set release order, then release date', () => {
    expect(isEarlierPrinting({ ...base, setIndex: 4 }, base)).toBe(true);
    expect(isEarlierPrinting({ ...base, setIndex: 6 }, base)).toBe(false);
    expect(isEarlierPrinting({ ...base, released_at: '2009-01-01' }, base)).toBe(true);
  });

  it('treats a missing setIndex as the very last set', () => {
    expect(isEarlierPrinting({ ...base, setIndex: -1 }, base)).toBe(false);
    expect(isEarlierPrinting(base, { ...base, setIndex: -1 })).toBe(true);
  });
});

describe('canonicalPrintingForName', () => {
  it('resolves a reskin to the card it reskins', () => {
    mockCardCatalog.printedCardList = reskinnedCard();

    const canonical = canonicalPrintingForName('Party Tree');
    expect(canonical?.name).toBe('The Great Henge');
    expect(canonical?.set).toBe('eld');
    // And the real name is its own canonical printing.
    expect(canonicalPrintingForName('The Great Henge')?.set).toBe('eld');
  });

  it('resolves a name to its original printing, not whichever came first in the catalog', () => {
    mockCardCatalog.printedCardList = [
      printing('Llanowar Elves', { oracle_id: 'elves', set: 'uma', setIndex: 40, reprint: true }),
      printing('Llanowar Elves', { oracle_id: 'elves', set: 'lea', setIndex: 0, reprint: false }),
    ];

    expect(canonicalPrintingForName('Llanowar Elves')?.set).toBe('lea');
  });

  it('normalizes the name it is given, like the rest of the catalog lookups', () => {
    mockCardCatalog.printedCardList = [printing('Déjà Vu', { name_lower: 'deja vu', oracle_id: 'deja' })];

    expect(canonicalPrintingForName('DÉJÀ vu')?.name).toBe('Déjà Vu');
  });

  it('has nothing to say about a name the catalog does not know', () => {
    mockCardCatalog.printedCardList = reskinnedCard();

    expect(canonicalPrintingForName('Not A Real Card')).toBeUndefined();
    // canonicalCardName hands unknown input straight back, so display code can
    // pass a user's raw answer through it unconditionally.
    expect(canonicalCardName('Not A Real Card')).toBe('Not A Real Card');
    expect(canonicalCardName('party tree')).toBe('The Great Henge');
  });

  it('ignores extras, so a token never shadows a real card', () => {
    mockCardCatalog.printedCardList = [
      printing('Beast', { oracle_id: 'beast-token', isToken: true, set: 'tok', setIndex: 0 }),
    ];

    expect(canonicalPrintingForName('Beast')).toBeUndefined();
  });
});

describe('originalPrintings', () => {
  it('keeps the real name and drops the reskin', () => {
    mockCardCatalog.printedCardList = reskinnedCard();

    const originals = originalPrintings();
    expect([...originals.keys()]).toEqual(['the great henge']);
    expect(originals.get('the great henge')?.set).toBe('eld');
  });

  it('keeps a card with no oracle id, having nothing to call it a reskin of', () => {
    mockCardCatalog.printedCardList = [printing('Custom Card', { oracle_id: '' })];

    expect([...originalPrintings().keys()]).toEqual(['custom card']);
  });

  it('keeps the reskin when the reskin is the earlier printing', () => {
    // Names come apart the other way round too: whichever name was printed first
    // is the card's own, and the rule is the same rule.
    mockCardCatalog.printedCardList = [
      printing('Later Name', { oracle_id: 'shared', set: 'bbb', setIndex: 7, reprint: true }),
      printing('Earlier Name', { oracle_id: 'shared', set: 'aaa', setIndex: 1, reprint: false }),
    ];

    expect([...originalPrintings().keys()]).toEqual(['earlier name']);
  });
});

describe('setsWithFirstPrinting', () => {
  it('holds the sets something premiered in and not the reprint-only ones', () => {
    mockCardCatalog.printedCardList = [
      printing('Original Card', { oracle_id: 'original', set: 'ELD', setIndex: 2, reprint: false }),
      printing('Original Card', { oracle_id: 'original', set: 'UMA', setIndex: 40, reprint: true }),
    ];

    const premiered = setsWithFirstPrinting();
    // Codes are lowercased so callers never have to care how the catalog cased them.
    expect(premiered.has('eld')).toBe(true);
    expect(premiered.has('uma')).toBe(false);
  });

  it('does not credit a set for a reskin printed there', () => {
    mockCardCatalog.printedCardList = reskinnedCard();

    expect([...setsWithFirstPrinting()]).toEqual(['eld']);
  });
});

describe('the withoutUniversesBeyond scope', () => {
  const ub: Partial<CardDetails> = { promo_types: ['universesbeyond'] };

  /**
   * Rick, Steadfast Leader premiered in a Walking Dead Secret Lair and came back
   * as Greymond, Avacyn's Stalwart: one oracle id, and the name printed first is
   * the Universes Beyond one.
   */
  const GREYMOND_ORACLE = 'greymond-oracle';
  const universesBeyondFirst = (): CardDetails[] => [
    printing('Rick, Steadfast Leader', {
      ...ub,
      oracle_id: GREYMOND_ORACLE,
      set: 'sld',
      setIndex: 5,
      released_at: '2020-10-26',
      reprint: false,
    }),
    printing("Greymond, Avacyn's Stalwart", {
      oracle_id: GREYMOND_ORACLE,
      set: 'slx',
      setIndex: 6,
      released_at: '2021-01-01',
      reprint: true,
    }),
  ];

  it('drops a card printed only in Universes Beyond and keeps one reprinted there', () => {
    mockCardCatalog.printedCardList = [
      printing("Frodo, Sauron's Bane", { ...ub, oracle_id: 'frodo', set: 'ltr', setIndex: 50, reprint: false }),
      printing('Sol Ring', { oracle_id: 'sol-ring', set: 'lea', setIndex: 0, reprint: false }),
      printing('Sol Ring', { ...ub, oracle_id: 'sol-ring', set: 'ltc', setIndex: 51, reprint: true }),
    ];

    expect([...originalPrintings().keys()]).toEqual(["frodo, sauron's bane", 'sol ring']);
    expect([...originalPrintings('withoutUniversesBeyond').keys()]).toEqual(['sol ring']);
    expect(printingsInScope('withoutUniversesBeyond').map((details) => details.set)).toEqual(['lea']);
    expect([...setsWithFirstPrinting('withoutUniversesBeyond')]).toEqual(['lea']);
  });

  it('makes the Universes Within name the real one when the Universes Beyond name came first', () => {
    mockCardCatalog.printedCardList = universesBeyondFirst();

    expect([...originalPrintings().keys()]).toEqual(['rick, steadfast leader']);
    expect([...originalPrintings('withoutUniversesBeyond').keys()]).toEqual(["greymond, avacyn's stalwart"]);
  });

  it('leaves canonicalPrintingForName looking at every printing', () => {
    mockCardCatalog.printedCardList = universesBeyondFirst();
    // Build the scoped index first, so a shared cache would be caught out.
    originalPrintings('withoutUniversesBeyond');

    expect(canonicalCardName("Greymond, Avacyn's Stalwart")).toBe('Rick, Steadfast Leader');
  });

  it('excludes a set only when every printing in it is Universes Beyond', () => {
    mockCardCatalog.printedCardList = [
      printing("Cloud, Planet's Champion", { ...ub, oracle_id: 'cloud', set: 'fin' }),
      printing('Sephiroth, Fabled SOLDIER', { ...ub, oracle_id: 'sephiroth', set: 'fin' }),
      printing('Birds of Paradise', { oracle_id: 'birds', set: 'sld' }),
      printing('Rick, Steadfast Leader', { ...ub, oracle_id: 'rick', set: 'sld' }),
      printing('Llanowar Elves', { oracle_id: 'elves', set: 'dom' }),
    ];

    expect([...excludedSets('withoutUniversesBeyond')]).toEqual(['fin']);
    expect([...excludedSets('all')]).toEqual([]);
  });
});

describe('eligiblePremiereSetCodes', () => {
  beforeEach(() => {
    mockCardCatalog.setdict = {
      eld: setInfo({ code: 'eld', name: 'Throne of Eldraine', releasedAt: '2019-10-04' }),
      uma: setInfo({ code: 'uma', name: 'Ultimate Masters', setType: 'masters', releasedAt: '2018-12-07' }),
      fut: setInfo({ code: 'fut', name: 'Future Sight', releasedAt: '2030-01-01' }),
    };
    mockCardCatalog.printedCardList = [
      printing('Original Card', { oracle_id: 'original', set: 'eld', setIndex: 2, reprint: false }),
      printing('Original Card', { oracle_id: 'original', set: 'uma', setIndex: 40, reprint: true }),
      printing('Unreleased Card', { oracle_id: 'unreleased', set: 'fut', setIndex: 99, reprint: false }),
    ];
  });

  it('drops a reprint-only set that eligibleSetCodes still admits', () => {
    // The wider pool is unchanged: recognising the *name* "Ultimate Masters" is a
    // fair ask, which is what the crossword and Synergy Connect use it for.
    expect(eligibleSetCodes('2026-01-01')).toEqual(['eld', 'uma']);
    // Naming a card *from* Ultimate Masters is not, so the narrower pool omits it.
    expect(eligiblePremiereSetCodes('2026-01-01')).toEqual(['eld']);
  });

  it('still respects the release-date bound', () => {
    expect(eligiblePremiereSetCodes('2019-01-01')).toEqual([]);
    expect(eligiblePremiereSetCodes('2019-10-04')).toEqual(['eld']);
  });
});
