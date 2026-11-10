import { cleanCube, cleanDeck, cleanPick, fnv1a, isTestRecord, windowStartFor } from '../../ml/trainingData';

describe('fnv1a', () => {
  it('matches the reference FNV-1a 32-bit values', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });
});

describe('isTestRecord', () => {
  it('always puts the same id in the same split', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `draft-${i}`);
    const first = ids.map((id) => isTestRecord(id));
    expect(ids.map((id) => isTestRecord(id))).toEqual(first);
  });

  it('holds out roughly the requested share', () => {
    const ids = Array.from({ length: 20000 }, (_, i) => `cube-${i}`);
    const share = ids.filter((id) => isTestRecord(id, 5)).length / ids.length;
    expect(share).toBeGreaterThan(0.04);
    expect(share).toBeLessThan(0.06);
  });
});

describe('windowStartFor', () => {
  it('goes back whole calendar years from the export date', () => {
    expect(windowStartFor(Date.UTC(2027, 1, 6, 12), 3)).toBe(Date.UTC(2024, 1, 6, 12));
  });
});

describe('cleanCube', () => {
  it('keeps unique in-vocabulary indices, sorted, including index 0', () => {
    expect(cleanCube([5, -1, 0, 5, 12, 3], 10)).toEqual([0, 3, 5]);
  });
});

describe('cleanDeck', () => {
  it('drops placeholders and basic lands', () => {
    expect(cleanDeck({ id: 'd', date: 1, mainboard: [1, 2, -1, 7], sideboard: [7, 3], basics: [7] }, 10)).toEqual({
      mainboard: [1, 2],
      sideboard: [3],
    });
  });
});

describe('cleanPick', () => {
  const base = { draft: 'd', date: 1 };

  it('removes the picked card and placeholders from the pool', () => {
    expect(cleanPick({ ...base, pack: [4, 5, -1], pool: [1, 4, -1], picked: 4 }, 10)).toEqual({
      pool: [1],
      pack: [4, 5],
      pick: 4,
    });
  });

  it('rejects picks that teach nothing', () => {
    expect(cleanPick({ ...base, pack: [4, 5], pool: [], picked: 6 }, 10)).toBeNull();
    expect(cleanPick({ ...base, pack: [4], pool: [], picked: 4 }, 10)).toBeNull();
    expect(cleanPick({ ...base, pack: [4, 5], pool: [], picked: -1 }, 10)).toBeNull();
  });
});
