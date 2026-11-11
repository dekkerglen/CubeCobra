import DraftSeat from '@utils/datatypes/DraftSeat';
import { deckProjection, sectionsEqual } from '@utils/records/recordSections';

import { createCard } from '../test-utils/data';

// A seat pool is number[][][] of indices into draft.cards; one pile is enough here,
// since what matters is the flattening and projection, not the pile layout.
const seatPool = (...indices: number[]): number[][][] => [[indices]];

describe('sectionsEqual', () => {
  it('treats reordered cards as a different deck', () => {
    expect(sectionsEqual(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('treats two structurally equal overview sections as equal', () => {
    const a = { name: 'Tuesday Night Cube', date: 1700000000000, description: 'Eight players, three rounds.' };
    // Built with the keys in a different order, to prove key order is not significant.
    const b = { description: 'Eight players, three rounds.', date: 1700000000000, name: 'Tuesday Night Cube' };

    expect(sectionsEqual(a, b)).toBe(true);
  });

  it('treats a changed description as unequal', () => {
    const a = { name: 'Tuesday Night Cube', date: 1700000000000, description: 'Eight players, three rounds.' };
    const b = { name: 'Tuesday Night Cube', date: 1700000000000, description: 'Eight players, four rounds.' };

    expect(sectionsEqual(a, b)).toBe(false);
  });
});

describe('deckProjection', () => {
  it('projects an absent seat as empty boards', () => {
    expect(deckProjection(undefined, [])).toEqual({ mainboard: [], sideboard: [] });
  });

  it('flattens a nested seat pool to oracle ids in order', () => {
    const cards = [createCard(), createCard(), createCard(), createCard()];
    const seat = {
      mainboard: seatPool(0, 2),
      sideboard: seatPool(3),
    } as DraftSeat;

    const projection = deckProjection(seat, cards);

    expect(projection.mainboard).toEqual([cards[0]!.details!.oracle_id, cards[2]!.details!.oracle_id]);
    expect(projection.sideboard).toEqual([cards[3]!.details!.oracle_id]);
  });
});
