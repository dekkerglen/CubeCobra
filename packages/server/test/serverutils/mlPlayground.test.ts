import { PrintingPreference } from '@utils/datatypes/Card';

// Fixtures are built inside the factories: @swc/jest hoists `jest.mock` above module-scope
// declarations, so an outer const would be in the TDZ when the factory runs.
jest.mock('serverutils/carddb', () => {
  const card = (scryfall_id: string, oracle_id: string, name: string, set: string, collector_number: string) => ({
    scryfall_id,
    oracle_id,
    name,
    set,
    collector_number,
    type: name === 'Plains' ? 'Basic Land — Plains' : 'Instant',
  });
  const cards: Record<string, any> = {
    'bolt-2xm': card('bolt-2xm', 'bolt', 'Lightning Bolt', '2xm', '117'),
    'bolt-m10': card('bolt-m10', 'bolt', 'Lightning Bolt', 'm10', '146'),
    'bolt-m11': card('bolt-m11', 'bolt', 'Lightning Bolt', 'm11', '149'),
    'new-card': card('new-card', 'new', 'New Card', 'new', '1'),
    'old-card': card('old-card', 'old', 'Old Card', 'old', '1'),
    mystery: card('mystery', 'mystery', 'Mystery Card', 'mys', '1'),
    plains: card('plains', 'plains', 'Plains', 'lea', '1'),
  };
  const byName: Record<string, string[]> = {
    'lightning bolt': ['bolt-2xm', 'bolt-m10', 'bolt-m11'],
    'new card': ['new-card'],
    'old card': ['old-card'],
    'mystery card': ['mystery'],
    plains: ['plains'],
  };
  return {
    cardFromId: (id: string) => cards[id] ?? { error: true },
    getIdsFromName: (name: string) => byName[name.toLowerCase()] ?? [],
    getMostReasonable: (name: string) => {
      const ids = byName[name.toLowerCase()];
      return ids ? cards[ids[0]!] : null;
    },
    // "New Card" is outside the model's vocabulary and "Old Card" is its most similar card.
    getOracleForMl: (oracle: string) => (oracle === 'new' ? 'old' : oracle),
    getReasonableCardByOracle: (oracle: string) => Object.values(cards).find((c) => c.oracle_id === oracle),
  };
});

jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: { oracleToIndex: { bolt: 0, old: 1, plains: 2 } },
}));

jest.mock('serverutils/ml', () => ({ isMlServiceError: () => false }));

import {
  isBasicLand,
  ListInputError,
  MAX_LIST_LINES,
  modelOracles,
  ratePastedCards,
  resolveList,
} from 'serverutils/mlPlayground';

const asIs = { substitute: false, printing: PrintingPreference.DEFAULT };
const substituting = { substitute: true, printing: PrintingPreference.DEFAULT };

describe('resolveList', () => {
  it('reads counts and set codes, merges repeats, and skips export headers and comments', () => {
    const list = resolveList(
      'Deck\n2 Lightning Bolt (M10) 146\n// a comment\nSideboard:\n1x Lightning Bolt *F*\nNot A Card\n\n',
      asIs,
    );

    expect(list.cards).toEqual([
      { cardID: 'bolt-m10', oracle: 'bolt', name: 'Lightning Bolt', count: 3, status: 'known' },
    ]);
    expect(list.missing).toEqual(['Not A Card']);
  });

  it('picks a printing from the set code alone, and the preferred printing without one', () => {
    expect(resolveList('Lightning Bolt [M11]', asIs).cards[0]?.cardID).toBe('bolt-m11');
    expect(resolveList('Lightning Bolt', asIs).cards[0]?.cardID).toBe('bolt-2xm');
    // An unknown set falls back to the preferred printing rather than dropping the card.
    expect(resolveList('Lightning Bolt (ZZZ)', asIs).cards[0]?.cardID).toBe('bolt-2xm');
  });

  it('marks cards the model does not know when not substituting', () => {
    const list = resolveList('New Card\nMystery Card', asIs);

    expect(list.cards.map((card) => card.status)).toEqual(['unknown', 'unknown']);
    expect(list.toMl).toEqual({ new: 'new', mystery: 'mystery' });
  });

  it('gives the model a stand-in for an unknown card when substituting', () => {
    const list = resolveList('New Card\nMystery Card', substituting);

    expect(list.cards[0]).toEqual({
      cardID: 'new-card',
      oracle: 'new',
      name: 'New Card',
      count: 1,
      status: 'substituted',
      substituteID: 'old-card',
      substituteName: 'Old Card',
    });
    // Nothing stands in for a card with no similar card.
    expect(list.cards[1]?.status).toBe('unknown');
    expect(list.toMl).toEqual({ new: 'old', mystery: 'mystery' });
    expect(list.fromMl).toEqual({ old: ['new'], mystery: ['mystery'] });
  });

  it('treats a missing list as empty', () => {
    expect(resolveList(undefined, asIs)).toMatchObject({ cards: [], missing: [] });
  });

  it('rejects lists that are not text or are too long', () => {
    expect(() => resolveList(['Lightning Bolt'], asIs)).toThrow(ListInputError);
    expect(() => resolveList('Plains\n'.repeat(MAX_LIST_LINES + 1), asIs)).toThrow(ListInputError);
  });
});

describe('modelOracles', () => {
  it('lists each oracle the model is given once, in list order', () => {
    const list = resolveList('New Card\nOld Card\nLightning Bolt', substituting);

    expect(modelOracles(list)).toEqual(['old', 'bolt']);
  });

  it('leaves out the cards the filter rejects', () => {
    const list = resolveList('Plains\nLightning Bolt', asIs);

    expect(modelOracles(list, (card) => !isBasicLand(list.details.get(card.oracle)))).toEqual(['bolt']);
  });
});

describe('ratePastedCards', () => {
  const list = () => resolveList('Mystery Card\nNew Card\nOld Card\nLightning Bolt', substituting);
  const rated = [
    { oracle: 'bolt', rating: 0.2 },
    { oracle: 'old', rating: 0.7 },
  ];

  it('rates every pasted card behind a stand-in, best first, with unrated cards last', () => {
    expect(ratePastedCards(list(), rated).map((card) => [card.name, card.rating])).toEqual([
      ['New Card', 0.7],
      ['Old Card', 0.7],
      ['Lightning Bolt', 0.2],
      ['Mystery Card', null],
    ]);
  });

  it('can rank worst first', () => {
    expect(ratePastedCards(list(), rated, false).map((card) => card.name)).toEqual([
      'Lightning Bolt',
      'New Card',
      'Old Card',
      'Mystery Card',
    ]);
  });

  it('ignores ratings for oracles that are not in the list', () => {
    const result = ratePastedCards(resolveList('Lightning Bolt', asIs), [{ oracle: 'elsewhere', rating: 0.9 }]);

    expect(result).toEqual([{ cardID: 'bolt-2xm', oracle: 'bolt', name: 'Lightning Bolt', rating: null }]);
  });
});
