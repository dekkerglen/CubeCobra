import type Card from '@utils/datatypes/Card';

import { releaseYearBuckets } from '../../src/utils/releaseYearBuckets';

const card = (firstPrintYear?: number) => ({ details: { firstPrintYear } }) as unknown as Card;

describe('releaseYearBuckets', () => {
  it('spans 1993 through the current year regardless of the cards present', () => {
    const buckets = releaseYearBuckets([card(2010)], 2026);

    expect(buckets[0].label).toBe('1993');
    expect(buckets[buckets.length - 1].label).toBe('2026');
    expect(buckets).toHaveLength(34);
  });

  it('spans the full range for a cube with no dated cards', () => {
    const buckets = releaseYearBuckets([], 2026);

    expect(buckets).toHaveLength(34);
    expect(buckets.every((b) => b.cards.length === 0)).toBe(true);
    expect(buckets.map((b) => b.label).join()).not.toMatch(/Infinity|NaN/);
  });

  it('excludes undated cards without stretching the axis', () => {
    const buckets = releaseYearBuckets([card(0), card(undefined), card(2010)], 2026);

    expect(buckets[0].label).toBe('1993');
    expect(buckets.flatMap((b) => b.cards)).toHaveLength(1);
  });

  it('expands past the current year rather than clipping a future-dated card', () => {
    const buckets = releaseYearBuckets([card(2028)], 2026);

    expect(buckets[buckets.length - 1].label).toBe('2028');
    expect(buckets[buckets.length - 1].cards).toHaveLength(1);
  });

  it('expands below 1993 rather than clipping an earlier-dated card', () => {
    const buckets = releaseYearBuckets([card(1990)], 2026);

    expect(buckets[0].label).toBe('1990');
  });

  it('keeps every year addressable so bar indices stay aligned with labels', () => {
    const buckets = releaseYearBuckets([card(1995), card(2026)], 2026);

    expect(buckets.map((b) => b.label)).toEqual(Array.from({ length: 34 }, (_, i) => String(1993 + i)));
    expect(buckets[2].cards).toHaveLength(1); // 1995
    expect(buckets[33].cards).toHaveLength(1); // 2026
  });
});
