import DraftLocation from '../../src/drafting/DraftLocation';
import { discardToPile, restoreFromPile } from '../../src/drafting/removedPile';

describe('discardToPile', () => {
  it('moves a card from its board onto the end of the pile', () => {
    const board = [[[], [7, 8]]];
    const result = discardToPile(board, DraftLocation.deck(0, 1, 0), [3]);

    expect(result).toEqual({ board: [[[], [8]]], pile: [3, 7] });
  });

  it('does not mutate its inputs', () => {
    const board = [[[], [7, 8]]];
    const pile = [3];
    discardToPile(board, DraftLocation.deck(0, 1, 0), pile);

    expect(board).toEqual([[[], [7, 8]]]);
    expect(pile).toEqual([3]);
  });
});

describe('restoreFromPile', () => {
  it('puts a pile card back at the target and drops it from the pile', () => {
    const sideboard = [[[], [], []]];
    const result = restoreFromPile([3, 7], 1, sideboard, DraftLocation.sideboard(0, 2, 0));

    expect(result).toEqual({ board: [[[], [], [7]]], pile: [3] });
  });

  it('restores into an occupied column at the drop position', () => {
    const result = restoreFromPile([5], 0, [[[1, 2]]], DraftLocation.deck(0, 0, 1));

    expect(result).toEqual({ board: [[[1, 5, 2]]], pile: [] });
  });

  it('keeps a basic land index outside the original pool unchanged', () => {
    const removed = discardToPile([[[42]]], DraftLocation.deck(0, 0, 0), []);
    const restored = restoreFromPile(removed.pile, 0, removed.board, DraftLocation.deck(0, 0, 0));

    expect(restored).toEqual({ board: [[[42]]], pile: [] });
  });

  it('does not mutate its inputs', () => {
    const pile = [3, 7];
    const board = [[[1]]];
    restoreFromPile(pile, 0, board, DraftLocation.deck(0, 0, 0));

    expect(pile).toEqual([3, 7]);
    expect(board).toEqual([[[1]]]);
  });
});
