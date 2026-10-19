import { applyIndexMap } from 'utils/applyIndexMap';

describe('applyIndexMap', () => {
  it('passes indices through untouched when no filter is active', () => {
    const indices = [0, 3, 7];

    expect(applyIndexMap(indices, null)).toEqual([0, 3, 7]);
  });

  it('returns the same array reference when no filter is active', () => {
    const indices = [1, 2];

    expect(applyIndexMap(indices, null)).toBe(indices);
  });

  it('remaps original indices onto their filtered positions', () => {
    // Originals 0..4, where 1 and 3 survived the filter and became 0 and 1.
    const indexMap = new Map([
      [1, 0],
      [3, 1],
    ]);

    expect(applyIndexMap([1, 3], indexMap)).toEqual([0, 1]);
  });

  it('drops indices that were filtered out', () => {
    const indexMap = new Map([
      [1, 0],
      [3, 1],
    ]);

    expect(applyIndexMap([0, 1, 2, 3, 4], indexMap)).toEqual([0, 1]);
  });

  it('keeps a filtered position of zero rather than treating it as missing', () => {
    const indexMap = new Map([[5, 0]]);

    expect(applyIndexMap([5], indexMap)).toEqual([0]);
  });

  it('returns an empty list when nothing survived the filter', () => {
    expect(applyIndexMap([0, 1, 2], new Map())).toEqual([]);
  });

  it('preserves the order it was given', () => {
    const indexMap = new Map([
      [4, 0],
      [2, 1],
      [9, 2],
    ]);

    expect(applyIndexMap([9, 2, 4], indexMap)).toEqual([2, 1, 0]);
  });
});
