import { cleanupOracleKey, findDuplicateRemovals, findOverlapRemovals, makeSwapPredicate } from '@utils/cubeCleanup';
import Card, { Changes, CubeCardSwap } from '@utils/datatypes/Card';

import { createCard, createCardDetails, createCardWithoutDetails } from '../test-utils/data';

describe('cleanupOracleKey', () => {
  it('returns the oracle id for a normal card', () => {
    const card = createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) });
    expect(cleanupOracleKey(card)).toBe('abc');
  });

  it('returns null for a custom card even when details carry an oracle id', () => {
    const card = createCard({
      index: 0,
      board: 'mainboard',
      cardID: 'custom-card',
      custom_name: 'My Custom Card',
      details: createCardDetails({ oracle_id: 'abc' }),
    });
    expect(cleanupOracleKey(card)).toBeNull();
  });

  it('returns null for a voucher', () => {
    const card = createCard({
      index: 0,
      board: 'mainboard',
      cardID: 'voucher',
      details: createCardDetails({ oracle_id: 'abc' }),
    });
    expect(cleanupOracleKey(card)).toBeNull();
  });

  it('returns null when the oracle id is an empty string', () => {
    const card = createCardWithoutDetails({ index: 0, board: 'mainboard' });
    expect(cleanupOracleKey(card)).toBeNull();
  });
});

describe('findDuplicateRemovals', () => {
  it('returns nothing for a board with no duplicates', () => {
    const cards = [
      createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: 'mainboard', details: createCardDetails({ oracle_id: 'def' }) }),
    ];
    expect(findDuplicateRemovals(cards)).toEqual([]);
  });

  it('groups two differently-named printings sharing an oracle id and removes one', () => {
    const cards = [
      createCard({
        index: 0,
        board: 'mainboard',
        details: createCardDetails({ oracle_id: 'abc', name: 'Lightning Bolt', set: 'lea' }),
      }),
      createCard({
        index: 1,
        board: 'mainboard',
        details: createCardDetails({ oracle_id: 'abc', name: 'Lightning Bolt // Nope', set: '2xm' }),
      }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([{ index: 1, board: 'mainboard' }]);
  });

  it('never groups two custom cards that share the custom-card cardID but differ in custom_name', () => {
    const cards = [
      createCard({
        index: 0,
        board: 'mainboard',
        cardID: 'custom-card',
        custom_name: 'Cobra One',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({
        index: 1,
        board: 'mainboard',
        cardID: 'custom-card',
        custom_name: 'Cobra Two',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([]);
  });

  it('never groups two cards that both lack details', () => {
    const cards = [
      createCardWithoutDetails({ index: 0, board: 'mainboard' }),
      createCardWithoutDetails({ index: 1, board: 'mainboard' }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([]);
  });

  it('skips cards marked for delete, treating three copies with one already removed as two', () => {
    const cards = [
      createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({
        index: 1,
        board: 'mainboard',
        markedForDelete: true,
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({ index: 2, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([{ index: 2, board: 'mainboard' }]);
  });

  it('skips cards reported by the isSwapped predicate', () => {
    const cards = [
      createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];

    expect(findDuplicateRemovals(cards, (card) => card.index === 1)).toEqual([]);
  });

  it('keeps the copy with the most tags', () => {
    const cards = [
      createCard({ index: 0, board: 'mainboard', tags: ['one'], details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({
        index: 1,
        board: 'mainboard',
        tags: ['one', 'two'],
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({ index: 2, board: 'mainboard', tags: [], details: createCardDetails({ oracle_id: 'abc' }) }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([
      { index: 0, board: 'mainboard' },
      { index: 2, board: 'mainboard' },
    ]);
  });

  it('breaks a tag tie on the longest notes', () => {
    const cards = [
      createCard({
        index: 0,
        board: 'mainboard',
        tags: ['one'],
        notes: 'short',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({
        index: 1,
        board: 'mainboard',
        tags: ['two'],
        notes: 'a much longer note',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([{ index: 0, board: 'mainboard' }]);
  });

  it('breaks a tags-and-notes tie on the oldest addedTmsp', () => {
    const cards = [
      createCard({
        index: 0,
        board: 'mainboard',
        tags: ['one'],
        notes: 'note',
        addedTmsp: '2000',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({
        index: 1,
        board: 'mainboard',
        tags: ['two'],
        notes: 'same',
        addedTmsp: '1000',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([{ index: 0, board: 'mainboard' }]);
  });

  it('falls through to the lowest index when every criterion ties', () => {
    const cards = [
      createCard({
        index: 5,
        board: 'mainboard',
        tags: ['one'],
        notes: 'note',
        addedTmsp: '1000',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({
        index: 2,
        board: 'mainboard',
        tags: ['two'],
        notes: 'same',
        addedTmsp: '1000',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({
        index: 9,
        board: 'mainboard',
        tags: ['three'],
        notes: 'also',
        addedTmsp: '1000',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([
      { index: 5, board: 'mainboard' },
      { index: 9, board: 'mainboard' },
    ]);
  });

  it('treats undefined tags and undefined notes as empty without throwing', () => {
    const cards = [
      createCard({ index: 3, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];

    expect(() => findDuplicateRemovals(cards)).not.toThrow();
    expect(findDuplicateRemovals(cards)).toEqual([{ index: 3, board: 'mainboard' }]);
  });

  it('orders a group deterministically when addedTmsp is missing or non-numeric', () => {
    const cards = [
      createCard({
        index: 4,
        board: 'mainboard',
        addedTmsp: 'not-a-number',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({ index: 2, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 7, board: 'mainboard', addedTmsp: '1000', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([
      { index: 2, board: 'mainboard' },
      { index: 4, board: 'mainboard' },
    ]);
  });

  it('treats a blank addedTmsp as missing rather than the epoch', () => {
    const cards = [
      createCard({ index: 0, board: 'mainboard', addedTmsp: '  ', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: 'mainboard', addedTmsp: '1000', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([{ index: 0, board: 'mainboard' }]);
  });

  it('skips cards that carry no index or no board', () => {
    const cards = [
      createCard({ index: undefined, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: undefined, details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 2, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([]);
  });

  it('groups on oracle id alone, never consulting the board, so callers must pass one board at a time', () => {
    const cards = [
      createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: 'maybeboard', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];

    expect(findDuplicateRemovals(cards)).toEqual([{ index: 1, board: 'maybeboard' }]);
  });

  it('returns an empty array for an empty board', () => {
    expect(findDuplicateRemovals([])).toEqual([]);
  });
});

describe('findOverlapRemovals', () => {
  it('removes every target card whose oracle id appears in the reference board', () => {
    const target = [
      createCard({ index: 0, board: 'maybeboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: 'maybeboard', details: createCardDetails({ oracle_id: 'def' }) }),
      createCard({ index: 2, board: 'maybeboard', details: createCardDetails({ oracle_id: 'ghi' }) }),
    ];
    const reference = [
      createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'ghi' }) }),
      createCard({ index: 1, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];

    expect(findOverlapRemovals(target, reference)).toEqual([
      { index: 0, board: 'maybeboard' },
      { index: 2, board: 'maybeboard' },
    ]);
  });

  it('removes all copies, keeping no survivor, when the target holds two copies of an overlapping card', () => {
    const target = [
      createCard({ index: 0, board: 'maybeboard', tags: ['keep'], details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: 'maybeboard', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];
    const reference = [createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) })];

    expect(findOverlapRemovals(target, reference)).toEqual([
      { index: 0, board: 'maybeboard' },
      { index: 1, board: 'maybeboard' },
    ]);
  });

  it('returns nothing when the boards share no oracle ids', () => {
    const target = [createCard({ index: 0, board: 'maybeboard', details: createCardDetails({ oracle_id: 'abc' }) })];
    const reference = [createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'def' }) })];

    expect(findOverlapRemovals(target, reference)).toEqual([]);
  });

  it('ignores reference cards marked for delete when building the overlap set', () => {
    const target = [createCard({ index: 0, board: 'maybeboard', details: createCardDetails({ oracle_id: 'abc' }) })];
    const reference = [
      createCard({
        index: 0,
        board: 'mainboard',
        markedForDelete: true,
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
    ];

    expect(findOverlapRemovals(target, reference)).toEqual([]);
  });

  it('ignores target cards marked for delete', () => {
    const target = [
      createCard({
        index: 0,
        board: 'maybeboard',
        markedForDelete: true,
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({ index: 1, board: 'maybeboard', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];
    const reference = [createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) })];

    expect(findOverlapRemovals(target, reference)).toEqual([{ index: 1, board: 'maybeboard' }]);
  });

  it('reports nothing when every eligible target card is already marked for delete', () => {
    const target = [
      createCard({
        index: 0,
        board: 'maybeboard',
        markedForDelete: true,
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({
        index: 1,
        board: 'maybeboard',
        markedForDelete: true,
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
    ];
    const reference = [createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) })];

    expect(findOverlapRemovals(target, reference)).toEqual([]);
  });

  it('ignores swapped cards on both the target and reference sides', () => {
    const target = [
      createCard({ index: 0, board: 'maybeboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: 'maybeboard', details: createCardDetails({ oracle_id: 'def' }) }),
    ];
    const reference = [
      createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: 'mainboard', details: createCardDetails({ oracle_id: 'def' }) }),
    ];

    // Swaps the target copy of abc and the reference copy of def, so neither oracle can match.
    const isSwapped = (card: Card): boolean =>
      (card.board === 'maybeboard' && card.index === 0) || (card.board === 'mainboard' && card.index === 1);

    expect(findOverlapRemovals(target, reference, isSwapped)).toEqual([]);
  });

  it('never matches custom cards or vouchers on either side', () => {
    const target = [
      createCard({
        index: 0,
        board: 'maybeboard',
        cardID: 'custom-card',
        custom_name: 'Cobra One',
        details: createCardDetails({ oracle_id: 'abc' }),
      }),
      createCard({ index: 1, board: 'maybeboard', details: createCardDetails({ oracle_id: 'def' }) }),
    ];
    const reference = [
      createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({
        index: 1,
        board: 'mainboard',
        cardID: 'voucher',
        details: createCardDetails({ oracle_id: 'def' }),
      }),
    ];

    expect(findOverlapRemovals(target, reference)).toEqual([]);
  });

  it('returns an empty array when the reference board is empty', () => {
    const target = [createCard({ index: 0, board: 'maybeboard', details: createCardDetails({ oracle_id: 'abc' }) })];

    expect(findOverlapRemovals(target, [])).toEqual([]);
  });
});

describe('makeSwapPredicate', () => {
  const swapOf = (index: number, oracleId: string): CubeCardSwap => ({
    index,
    oldCard: createCard({ index, board: 'mainboard', details: createCardDetails({ oracle_id: oracleId }) }),
    card: createCard({ index, board: 'mainboard', details: createCardDetails({ oracle_id: `${oracleId}-new` }) }),
  });

  it('reports true for a card whose board and index have a staged swap', () => {
    const changes: Changes = { version: 3, mainboard: { swaps: [swapOf(2, 'abc')] } };
    const isSwapped = makeSwapPredicate(changes);

    expect(isSwapped(createCard({ index: 2, board: 'mainboard' }))).toBe(true);
    expect(isSwapped(createCard({ index: 3, board: 'mainboard' }))).toBe(false);
  });

  it('reports false for a card at the same index on a different board', () => {
    const changes: Changes = { mainboard: { swaps: [swapOf(2, 'abc')] } };

    expect(makeSwapPredicate(changes)(createCard({ index: 2, board: 'maybeboard' }))).toBe(false);
  });

  it('reports false when the board has edits and removes but no swaps', () => {
    const oldCard = createCard({ index: 2, board: 'mainboard' });
    const changes: Changes = {
      mainboard: {
        removes: [{ index: 4, oldCard }],
        edits: [{ index: 2, oldCard, newCard: createCard({ index: 2, board: 'mainboard' }) }],
      },
    };
    const isSwapped = makeSwapPredicate(changes);

    expect(isSwapped(createCard({ index: 2, board: 'mainboard' }))).toBe(false);
    expect(isSwapped(createCard({ index: 4, board: 'mainboard' }))).toBe(false);
  });

  it('reports false for every card when changes is empty', () => {
    const isSwapped = makeSwapPredicate({});

    expect(isSwapped(createCard({ index: 0, board: 'mainboard' }))).toBe(false);
    expect(isSwapped(createCard({ index: 1, board: 'maybeboard' }))).toBe(false);
  });

  it('reports false for a card with no stamped board or index', () => {
    const isSwapped = makeSwapPredicate({ mainboard: { swaps: [swapOf(2, 'abc')] } });

    expect(isSwapped(createCard({ index: 2, board: undefined }))).toBe(false);
    expect(isSwapped(createCard({ index: undefined, board: 'mainboard' }))).toBe(false);
  });

  it('excludes a swapped card from duplicate cleanup when wired into findDuplicateRemovals', () => {
    const cards = [
      createCard({ index: 0, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
      createCard({ index: 1, board: 'mainboard', details: createCardDetails({ oracle_id: 'abc' }) }),
    ];
    const isSwapped = makeSwapPredicate({ mainboard: { swaps: [swapOf(1, 'abc')] } });

    expect(findDuplicateRemovals(cards, isSwapped)).toEqual([]);
  });
});
