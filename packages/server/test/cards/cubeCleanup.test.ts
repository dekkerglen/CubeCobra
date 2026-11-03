import { cleanupOracleKey, findDuplicateRemovals } from '@utils/cubeCleanup';

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

  it('returns an empty array for an empty board', () => {
    expect(findDuplicateRemovals([])).toEqual([]);
  });
});
