import { Changes } from '../../src/datatypes/Card';
import { applyReversedChanges, mergeChanges, revertChanges } from '../../src/util/changelog';
import { createCard } from '../test-utils/data';

describe('mergeChanges', () => {
  it('should merge changelogs', () => {
    expect(mergeChanges([])).toEqual({ mainboard: {}, maybeboard: {}, version: 0 });
  });

  it('should merge changelogs with only adds', () => {
    const card1 = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });
    const card3 = createCard({ index: 2 });
    const card4 = createCard({ index: 3 });

    expect(
      mergeChanges([
        { mainboard: { adds: [card1, card2] }, version: 1 },
        { mainboard: { adds: [card3] }, version: 2 },
        { mainboard: { adds: [card4] }, version: 3 },
      ]),
    ).toEqual({
      mainboard: { adds: [card1, card2, card3, card4] },
      maybeboard: {},
      version: 3,
    });
  });

  it('should not log a card that was added then removed', () => {
    const card1 = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });
    const card3 = createCard({ index: 2 });

    expect(
      mergeChanges([
        { mainboard: { adds: [card1, card2], removes: [{ index: 2, oldCard: card3 }] }, version: 1 },
        { mainboard: { removes: [{ index: 0, oldCard: card1 }] }, version: 2 },
      ]),
    ).toEqual({
      mainboard: { adds: [card2], removes: [{ index: 2, oldCard: card3 }] },
      maybeboard: {},
      version: 2,
    });
  });

  it('should include an add for the latest edit if both ops are found', () => {
    const card1 = createCard({ index: 0, status: 'Not Owned' });
    const card1Edited = createCard({ index: 0, status: 'Owned', details: card1.details });
    const card2 = createCard({ index: 1 });
    const card3 = createCard({ index: 2 });

    expect(
      mergeChanges([
        { mainboard: { adds: [card1, card2] }, version: 1 },
        { mainboard: { edits: [{ index: 0, oldCard: card1, newCard: card1Edited }] }, version: 2 },
        { mainboard: { adds: [card3] }, version: 3 },
      ]),
    ).toEqual({
      mainboard: { adds: [card1Edited, card2, card3] },
      maybeboard: {},
      version: 3,
    });
  });

  it('should keep edits if card was added previously', () => {
    const card1 = createCard({ index: 0, status: 'Ordered' });
    const card1Edited = createCard({ index: 0, status: 'Owned', details: card1.details });
    const card2 = createCard({ index: 1 });

    expect(
      mergeChanges([
        { mainboard: { adds: [card2] }, version: 1 },
        { mainboard: { edits: [{ index: 0, oldCard: card1, newCard: card1Edited }] }, version: 2 },
      ]),
    ).toEqual({
      mainboard: { adds: [card2], edits: [{ index: 0, oldCard: card1, newCard: card1Edited }] },
      maybeboard: {},
      version: 2,
    });
  });

  it('should not log anything if card is added then removed', () => {
    const card1 = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });

    expect(
      mergeChanges([
        { mainboard: { adds: [card1, card2] }, version: 1 },
        { mainboard: { removes: [{ index: 0, oldCard: card1 }] }, version: 2 },
      ]),
    ).toEqual({
      mainboard: { adds: [card2] },
      maybeboard: {},
      version: 2,
    });
  });

  it('should should not log anything if a card is removed then added', () => {
    const card1 = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });

    expect(
      mergeChanges([
        { mainboard: { removes: [{ index: 0, oldCard: card1 }] }, version: 1 },
        { mainboard: { adds: [card1, card2] }, version: 2 },
      ]),
    ).toEqual({
      mainboard: { adds: [card2] },
      maybeboard: {},
      version: 2,
    });
  });

  it('should merge maybeboard changelogs with only adds', () => {
    const card1 = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });
    const card3 = createCard({ index: 2 });

    expect(
      mergeChanges([
        { maybeboard: { adds: [card1] }, version: 1 },
        { maybeboard: { adds: [card2, card3] }, version: 2 },
      ]),
    ).toEqual({
      mainboard: {},
      maybeboard: { adds: [card1, card2, card3] },
      version: 2,
    });
  });

  it('should handle swap operations on mainboard', () => {
    const card1 = createCard({ index: 0 });
    const card1Swapped = createCard({ index: 0 });

    expect(
      mergeChanges([{ mainboard: { swaps: [{ index: 0, oldCard: card1, card: card1Swapped }] }, version: 1 }]),
    ).toEqual({
      mainboard: { swaps: [{ index: 0, oldCard: card1, card: card1Swapped }] },
      maybeboard: {},
      version: 1,
    });
  });

  it('should override a swap with a later edit operation on the same card', () => {
    const card1 = createCard({ index: 0 });
    const card1Swapped = createCard({ index: 0, status: 'Not Owned' });
    const card1Edited = createCard({ index: 0, status: 'Owned', details: card1Swapped.details });

    expect(
      mergeChanges([
        {
          mainboard: {
            swaps: [{ index: 0, oldCard: card1, card: card1Swapped }],
          },
          version: 1,
        },
        {
          mainboard: {
            edits: [{ index: 0, oldCard: card1Swapped, newCard: card1Edited }],
          },
          version: 2,
        },
      ]),
    ).toEqual({
      mainboard: { edits: [{ index: 0, oldCard: card1Swapped, newCard: card1Edited }] },
      maybeboard: {},
      version: 2,
    });
  });

  it('should override an edit with a later swap operation on the same card', () => {
    const card1 = createCard({ index: 0, status: 'Not Owned' });
    const card1Edited = createCard({ index: 0, status: 'Owned', details: card1.details });
    const card1Swapped = createCard({ index: 0 });

    expect(
      mergeChanges([
        {
          mainboard: {
            edits: [{ index: 0, oldCard: card1, newCard: card1Edited }],
          },
          version: 1,
        },
        {
          mainboard: {
            swaps: [{ index: 0, oldCard: card1Edited, card: card1Swapped }],
          },
          version: 2,
        },
      ]),
    ).toEqual({
      mainboard: { swaps: [{ index: 0, oldCard: card1Edited, card: card1Swapped }] },
      maybeboard: {},
      version: 2,
    });
  });

  it('should not log any operation if a card undergoes add, remove, then add, then remove', () => {
    const card1 = createCard({ index: 0, status: 'Not Owned' });
    const card1Edited = createCard({ index: 0, status: 'Owned', details: card1.details });

    expect(
      mergeChanges([
        { mainboard: { adds: [card1] }, version: 1 },
        { mainboard: { removes: [{ index: 0, oldCard: card1 }] }, version: 2 },
        { mainboard: { adds: [card1Edited] }, version: 3 },
        { mainboard: { removes: [{ index: 0, oldCard: card1Edited }] }, version: 4 },
      ]),
    ).toEqual({
      mainboard: {},
      maybeboard: {},
      version: 4,
    });
  });

  it('should override op with same version if they conflict (edit after add in the same version)', () => {
    const card1 = createCard({ index: 0, status: 'Not Owned' });
    const card1Edited = createCard({ index: 0, status: 'Owned', details: card1.details });

    expect(
      mergeChanges([
        { mainboard: { adds: [card1] }, version: 1 },
        { mainboard: { edits: [{ index: 0, oldCard: card1, newCard: card1Edited }] }, version: 1 },
      ]),
    ).toEqual({
      mainboard: { adds: [card1Edited] },
      maybeboard: {},
      version: 1,
    });
  });

  it('should handle operations on both mainboard and maybeboard independently', () => {
    const mainCard = createCard({ index: 0, status: 'Not Owned' });
    const maybeCard = createCard({ index: 0 });
    const mainCardEdited = createCard({ index: 0, status: 'Owned', details: mainCard.details });

    expect(
      mergeChanges([
        {
          mainboard: { adds: [mainCard] },
          maybeboard: { adds: [maybeCard] },
          version: 1,
        },
        {
          mainboard: { edits: [{ index: 0, oldCard: mainCard, newCard: mainCardEdited }] },
          version: 2,
        },
      ]),
    ).toEqual({
      mainboard: { adds: [mainCardEdited] },
      maybeboard: { adds: [maybeCard] },
      version: 2,
    });
  });

  it('should handle removal on maybeboard correctly', () => {
    const card1 = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });

    expect(
      mergeChanges([
        { maybeboard: { adds: [card1, card2] }, version: 1 },
        { maybeboard: { removes: [{ index: 0, oldCard: card1 }] }, version: 2 },
      ]),
    ).toEqual({
      mainboard: {},
      maybeboard: { adds: [card2] },
      version: 2,
    });
  });

  it('should log an edit op for a card that was never added', () => {
    const card1 = createCard({ index: 0, status: 'Not Owned' });
    const card1Edited = createCard({ index: 1, status: 'Owned', details: card1.details });

    expect(
      mergeChanges([{ mainboard: { edits: [{ index: 0, oldCard: card1, newCard: card1Edited }] }, version: 1 }]),
    ).toEqual({
      mainboard: { edits: [{ index: 0, oldCard: card1, newCard: card1Edited }] },
      maybeboard: {},
      version: 1,
    });
  });
});

describe('revertChanges', () => {
  it('should revert an empty changes array', () => {
    expect(revertChanges([])).toEqual({ mainboard: {}, maybeboard: {}, version: 0 });
  });

  it('should revert mainboard adds into removals', () => {
    const card1 = createCard({ index: 1 });
    const card2 = createCard({ index: 2 });
    const changes = [{ mainboard: { adds: [card1, card2] }, version: 1 }];

    expect(revertChanges(changes)).toEqual({
      mainboard: {
        removes: [
          { index: card1.index!, oldCard: card1 },
          { index: card2.index!, oldCard: card2 },
        ],
      },
      maybeboard: {},
      version: 1,
    });
  });

  it('should revert mainboard removes into adds', () => {
    const card1 = createCard({ index: 1 });
    const changes = [{ mainboard: { removes: [{ index: card1.index!, oldCard: card1 }] }, version: 2 }];

    expect(revertChanges(changes)).toEqual({
      mainboard: { adds: [card1] },
      maybeboard: {},
      version: 2,
    });
  });

  it('should revert mainboard swap operations', () => {
    const card1 = createCard({ index: 1 });
    const card1Swapped = createCard({ index: 1 });
    const changes = [
      { mainboard: { swaps: [{ index: card1.index!, oldCard: card1, card: card1Swapped }] }, version: 3 },
    ];

    expect(revertChanges(changes)).toEqual({
      mainboard: {
        adds: [card1],
        removes: [{ index: card1.index!, oldCard: card1Swapped }],
      },
      maybeboard: {},
      version: 3,
    });
  });

  it('should revert mainboard edit operations', () => {
    const card1 = createCard({ index: 1, status: 'Not Owned' });
    const card1Edited = createCard({ index: 1, status: 'Owned', details: card1.details });
    const changes = [
      { mainboard: { edits: [{ index: card1.index!, oldCard: card1, newCard: card1Edited }] }, version: 4 },
    ];

    expect(revertChanges(changes)).toEqual({
      mainboard: {
        edits: [{ index: card1.index!, oldCard: card1Edited, newCard: card1 }],
      },
      maybeboard: {},
      version: 4,
    });
  });

  it('should revert maybeboard operations correctly', () => {
    const card1 = createCard({ index: 1 });
    const card2 = createCard({ index: 2 });
    const card3 = createCard({ index: 3 });
    const card3Swapped = createCard({ index: 3 });
    const card4 = createCard({ index: 4, status: 'Not Owned' });
    const card4Edited = createCard({ index: 4, status: 'Owned', details: card4.details });

    const changes = [
      { maybeboard: { adds: [card1] }, version: 1 },
      { maybeboard: { removes: [{ index: card2.index!, oldCard: card2 }] }, version: 2 },
      { maybeboard: { swaps: [{ index: card3.index!, oldCard: card3, card: card3Swapped }] }, version: 3 },
      { maybeboard: { edits: [{ index: card4.index!, oldCard: card4, newCard: card4Edited }] }, version: 4 },
    ];

    expect(revertChanges(changes)).toEqual({
      mainboard: {},
      maybeboard: {
        removes: [
          { index: card1.index!, oldCard: card1 },
          { index: card3Swapped.index!, oldCard: card3Swapped },
        ],
        adds: [card2, card3],
        edits: [{ index: card4.index!, oldCard: card4Edited, newCard: card4 }],
      },
      version: 4,
    });
  });

  it('should revert mixed operations on both mainboard and maybeboard', () => {
    const mCard1 = createCard({ index: 1 });
    const mCard2 = createCard({ index: 2 });
    const mCard3 = createCard({ index: 3 });
    const mCard4 = createCard({ index: 4 });
    const mCard4Swapped = createCard({ index: 4 });
    const mCard5 = createCard({ index: 5, status: 'Not Owned' });
    const mCard5Edited = createCard({ index: 5, status: 'Owned', details: mCard5.details });

    const mbCard1 = createCard({ index: 1 });
    const mbCard2 = createCard({ index: 2 });
    const mbCard3 = createCard({ index: 3 });
    const mbCard4 = createCard({ index: 4, status: 'Not Owned' });
    const mbCard4Edited = createCard({ index: 4, status: 'Owned', details: mbCard4.details });

    const changes = [
      {
        mainboard: {
          adds: [mCard1, mCard2],
          removes: [{ index: mCard3.index!, oldCard: mCard3 }],
          swaps: [{ index: mCard4.index!, oldCard: mCard4, card: mCard4Swapped }],
          edits: [{ index: mCard5.index!, oldCard: mCard5, newCard: mCard5Edited }],
        },
        maybeboard: {
          adds: [mbCard1, mbCard2],
          removes: [{ index: mbCard3.index!, oldCard: mbCard3 }],
          edits: [{ index: mbCard4.index!, oldCard: mbCard4, newCard: mbCard4Edited }],
        },
        version: 5,
      },
    ];

    expect(revertChanges(changes)).toEqual({
      mainboard: {
        adds: [mCard3, mCard4],
        removes: [
          { index: mCard1.index!, oldCard: mCard1 },
          { index: mCard2.index!, oldCard: mCard2 },
          { index: mCard4.index!, oldCard: mCard4Swapped },
        ],
        edits: [{ index: mCard5.index!, oldCard: mCard5Edited, newCard: mCard5 }],
      },
      maybeboard: {
        adds: [mbCard3],
        removes: [
          { index: mbCard1.index!, oldCard: mbCard1 },
          { index: mbCard2.index!, oldCard: mbCard2 },
        ],
        edits: [{ index: mbCard4.index!, oldCard: mbCard4Edited, newCard: mbCard4 }],
      },
      version: 5,
    });
  });
});

describe('applyReversedChanges', () => {
  it('should return the unchanged deck if no changes are provided', () => {
    const card1 = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });
    const card3 = createCard({ index: 0 });

    const cube = {
      mainboard: [card1, card2],
      maybeboard: [card3],
    };

    expect(applyReversedChanges(cube, [])).toEqual({
      mainboard: [card1, card2],
      maybeboard: [card3],
    });
  });

  it('should remove a card from mainboard when a forward add is reversed', () => {
    const card1 = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });
    const card3 = createCard({ index: 2 });

    const cube = { mainboard: [card1, card2, card3], maybeboard: [] };
    const changes = [{ mainboard: { adds: [card1] }, version: 1 }];

    expect(applyReversedChanges(cube, changes)).toEqual({
      mainboard: [
        { ...card2, index: 0 },
        { ...card3, index: 1 },
      ],
      maybeboard: [],
    });
  });

  it('should add a card to mainboard when a forward remove is reversed', () => {
    const card1 = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });
    const card3 = createCard({ index: 2 });

    const cube = { mainboard: [card1, card3], maybeboard: [] };
    const changes: Changes[] = [{ mainboard: { removes: [{ index: card2.index!, oldCard: card2 }] }, version: 1 }];

    expect(applyReversedChanges(cube, changes).mainboard).toEqual([card1, card2, card3]);
  });

  it('should revert a mainboard edit operation', () => {
    const card1 = createCard({ index: 0, status: 'Not Owned' });
    const card1Edited = createCard({ index: 0, status: 'Owned', details: card1.details });
    const card2 = createCard({ index: 1 });

    const cube = { mainboard: [card1Edited, card2], maybeboard: [] };
    const changes: Changes[] = [
      { mainboard: { edits: [{ index: card1.index!, oldCard: card1, newCard: card1Edited }] }, version: 1 },
    ];

    expect(applyReversedChanges(cube, changes).mainboard).toEqual([card1, card2]);
  });

  it('should revert a mainboard swap operation', () => {
    const card1 = createCard({ index: 0 });
    const card1Swapped = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });

    const cube = { mainboard: [card1Swapped, card2], maybeboard: [] };
    const changes: Changes[] = [
      { mainboard: { swaps: [{ index: card1.index!, oldCard: card1, card: card1Swapped }] }, version: 1 },
    ];

    expect(applyReversedChanges(cube, changes).mainboard).toEqual([card1, card2]);
  });

  it('should revert maybeboard operations correctly', () => {
    const card1 = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });
    const card3 = createCard({ index: 2 });

    const cube = { mainboard: [], maybeboard: [card1, card3] };
    const changes: Changes[] = [
      { maybeboard: { adds: [card1] }, version: 1 },
      { maybeboard: { removes: [{ index: card2.index!, oldCard: card2 }] }, version: 2 },
    ];

    expect(applyReversedChanges(cube, changes).maybeboard).toEqual([
      { ...card2, index: 0 },
      { ...card3, index: 1 },
    ]);
  });

  it('should handle mixed operations on both boards', () => {
    const card1 = createCard({ index: 0 });
    const card1Swapped = createCard({ index: 0 });
    const card2 = createCard({ index: 1 });
    const card3 = createCard({ index: 2 });
    const card4 = createCard({ index: 0, status: 'Not Owned' });
    const card4Edited = createCard({ index: 0, status: 'Owned', details: card4.details });

    const cube = { mainboard: [card1Swapped, card2], maybeboard: [card4Edited] };

    const changes: Changes[] = [
      {
        mainboard: {
          swaps: [{ index: card1.index!, oldCard: card1, card: card1Swapped }],
          removes: [{ index: card3.index!, oldCard: card3 }],
        },
        maybeboard: {
          edits: [{ index: card4.index!, oldCard: card4, newCard: card4Edited }],
        },
        version: 1,
      },
    ];

    expect(applyReversedChanges(cube, changes)).toEqual({
      mainboard: [
        { ...card1, index: 0 },
        { ...card2, index: 1 },
        { ...card3, index: 2 },
      ],
      maybeboard: [card4],
    });
  });
});
