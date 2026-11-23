import Card, { Changes } from '@utils/datatypes/Card';

import { changelogToBoardRows } from 'utils/changelogCards';

const card = (cardID: string): Card => ({ cardID }) as Card;

describe('changelogToBoardRows', () => {
  it('orders added as adds then swap-ins, removed as removes then swap-outs', () => {
    const changelog = {
      mainboard: {
        adds: [card('A')],
        removes: [{ index: 0, oldCard: card('R') }],
        swaps: [{ index: 1, oldCard: card('S1o'), card: card('S1n') }],
        edits: [],
      },
    } as unknown as Changes;

    const [rows] = changelogToBoardRows(changelog);

    expect(rows.added.map((e) => e.card.cardID)).toEqual(['A', 'S1n']);
    expect(rows.added.map((e) => e.kind)).toEqual(['add', 'swap']);
    expect(rows.removed.map((e) => e.card.cardID)).toEqual(['R', 'S1o']);
    expect(rows.removed.map((e) => e.kind)).toEqual(['remove', 'swap']);
  });

  it('gives both halves of a swap the same id, unique per board', () => {
    const changelog = {
      mainboard: { swaps: [{ index: 0, oldCard: card('Mo'), card: card('Mn') }] },
      maybeboard: { swaps: [{ index: 0, oldCard: card('Bo'), card: card('Bn') }] },
    } as unknown as Changes;

    const [main, maybe] = changelogToBoardRows(changelog);

    expect(main.added[0].swapId).toBe('mainboard:0');
    expect(main.removed[0].swapId).toBe('mainboard:0');
    expect(maybe.added[0].swapId).toBe('maybeboard:0');
    expect(maybe.removed[0].swapId).toBe('maybeboard:0');
    expect(main.added[0].swapId).not.toBe(maybe.added[0].swapId);
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
