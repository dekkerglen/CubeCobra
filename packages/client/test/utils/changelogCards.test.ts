import Card, { Changes } from '@utils/datatypes/Card';

import { changelogToBoardRows } from 'utils/changelogCards';

const card = (cardID: string): Card => ({ cardID }) as Card;

describe('changelogToBoardRows', () => {
  it('keeps adds and removes plain and returns swaps as pairs', () => {
    const changelog = {
      mainboard: {
        adds: [card('A')],
        removes: [{ index: 0, oldCard: card('R') }],
        swaps: [{ index: 1, oldCard: card('S1o'), card: card('S1n') }],
        edits: [],
      },
    } as unknown as Changes;

    const [rows] = changelogToBoardRows(changelog);

    expect(rows.added.map((e) => e.card.cardID)).toEqual(['A']);
    expect(rows.removed.map((e) => e.card.cardID)).toEqual(['R']);
    expect(rows.swapped.map((s) => [s.oldCard.cardID, s.card.cardID])).toEqual([['S1o', 'S1n']]);
  });

  it('skips a swap missing either card', () => {
    const changelog = {
      mainboard: {
        swaps: [
          { index: 0, oldCard: card('X') },
          { index: 1, card: card('Y') },
          { index: 2, oldCard: card('P'), card: card('Q') },
        ],
      },
    } as unknown as Changes;

    const [rows] = changelogToBoardRows(changelog);

    expect(rows.swapped.map((s) => [s.oldCard.cardID, s.card.cardID])).toEqual([['P', 'Q']]);
  });

  it('renders a swaps-only board with no added or removed entries', () => {
    const changelog = {
      mainboard: { swaps: [{ index: 0, oldCard: card('P'), card: card('Q') }] },
    } as unknown as Changes;

    const result = changelogToBoardRows(changelog);

    expect(result).toHaveLength(1);
    expect(result[0].added).toEqual([]);
    expect(result[0].removed).toEqual([]);
    expect(result[0].edited).toEqual([]);
    expect(result[0].swapped).toHaveLength(1);
  });

  it('uses the new card for edits', () => {
    const changelog = {
      mainboard: { edits: [{ index: 0, oldCard: card('E0'), newCard: card('E1') }] },
    } as unknown as Changes;

    const [rows] = changelogToBoardRows(changelog);

    expect(rows.edited[0].card.cardID).toBe('E1');
    expect(rows.edited[0].kind).toBe('edit');
  });

  it('counts like the text heading', () => {
    const changelog = {
      mainboard: {
        adds: [card('A')],
        removes: [{ index: 0, oldCard: card('R') }],
        swaps: [{ index: 1, oldCard: card('So'), card: card('Sn') }],
        edits: [{ index: 2, oldCard: card('E0'), newCard: card('E1') }],
      },
    } as unknown as Changes;

    const [rows] = changelogToBoardRows(changelog);

    expect(rows.addCount).toBe(2);
    expect(rows.removeCount).toBe(2);
    expect(rows.editCount).toBe(1);
  });

  it('skips version, empty boards and tolerates missing arrays', () => {
    const changelog = {
      version: 3,
      mainboard: {},
      maybeboard: { edits: [{ index: 0, oldCard: card('E0'), newCard: card('E1') }] },
    } as unknown as Changes;

    const result = changelogToBoardRows(changelog);

    expect(result).toHaveLength(1);
    expect(result[0].board).toBe('maybeboard');
    expect(result[0].added).toEqual([]);
    expect(result[0].removed).toEqual([]);
    expect(result[0].edited).toHaveLength(1);
  });
});
