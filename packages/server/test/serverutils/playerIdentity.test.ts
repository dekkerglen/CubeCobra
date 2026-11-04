import { reconcilePlayerIds, stampSeatPlayerIds } from 'serverutils/playerIdentity';

describe('reconcilePlayerIds', () => {
  it('inherits by position when the submission carries no ids', () => {
    const stored = [
      { name: 'Alice', id: 'a' },
      { name: 'Bob', id: 'b' },
    ];
    const result = reconcilePlayerIds([{ name: 'Alice' }, { name: 'Bob' }], stored);
    expect(result.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('inherits by position even when the name at that position changed', () => {
    const stored = [{ name: 'Alice', id: 'a' }];
    expect(reconcilePlayerIds([{ name: 'Alicia' }], stored)[0]!.id).toBe('a');
  });

  it('falls back to matching by name when positions shifted', () => {
    const stored = [
      { name: 'Alice', id: 'a' },
      { name: 'Bob', id: 'b' },
    ];
    const result = reconcilePlayerIds([{ name: 'Bob' }, { name: 'Alice' }], stored);
    expect(result.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('prefers a submitted id over both fallbacks', () => {
    const stored = [
      { name: 'Alice', id: 'a' },
      { name: 'Bob', id: 'b' },
    ];
    expect(reconcilePlayerIds([{ name: 'Alice', id: 'b' }], stored)[0]!.id).toBe('b');
  });

  it('mints only for a player with no match', () => {
    const result = reconcilePlayerIds([{ name: 'Alice', id: 'a' }, { name: 'Carol' }], [{ name: 'Alice', id: 'a' }]);
    expect(result[1]!.id).toBeDefined();
    expect(result[1]!.id).not.toBe('a');
  });

  it('never assigns the same id twice', () => {
    const stored = [{ name: 'Alice', id: 'a' }];
    const result = reconcilePlayerIds([{ name: 'Alice' }, { name: 'Alice2' }], stored);
    expect(new Set(result.map((p) => p.id)).size).toBe(2);
  });

  it('mints for every player when nothing is stored', () => {
    const result = reconcilePlayerIds([{ name: 'Alice' }, { name: 'Bob' }], []);
    expect(result.every((p) => !!p.id)).toBe(true);
  });
});

describe('stampSeatPlayerIds', () => {
  it('stamps each seat from the player at its index without touching other fields', () => {
    const seats = [{ mainboard: [], sideboard: [], title: 'Alice' }];
    const result = stampSeatPlayerIds(seats as any, [{ name: 'Alice', id: 'a' }]);
    expect(result[0]!.playerId).toBe('a');
    expect(result[0]!.title).toBe('Alice');
  });

  it('leaves a seat with no matching player alone', () => {
    const seats = [
      { mainboard: [], sideboard: [] },
      { mainboard: [], sideboard: [] },
    ];
    const result = stampSeatPlayerIds(seats as any, [{ name: 'Alice', id: 'a' }]);
    expect(result[1]!.playerId).toBeUndefined();
  });
});
