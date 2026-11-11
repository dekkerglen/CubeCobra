import { buildDraftKeySlices, draftKey, sliceHasKey } from '../utils/draftKeySlices';

const DAY = 24 * 60 * 60 * 1000;
const EARLIEST = Date.UTC(2015, 0, 1);
const LATEST = Date.UTC(2026, 11, 1);
const slices = buildDraftKeySlices(['u'], EARLIEST, LATEST, 30 * DAY);

// Sort keys seen in production for uploads, plus every boundary and its neighbors.
const keys = [
  'DATE#-55668643200000',
  'DATE#-61979644800000',
  'DATE#706579200000',
  'DATE#160000000000',
  'DATE#1574300762415',
  'DATE#1794361993338',
  'DATE#1806537600000',
  'DATE#99999999999999',
  'DATE#0',
  'DATE#',
  ...slices.flatMap((slice) =>
    [slice.from, slice.to].flatMap((bound) =>
      bound === undefined ? [] : [draftKey(bound - 1), draftKey(bound), draftKey(bound + 1)],
    ),
  ),
];

describe('buildDraftKeySlices', () => {
  it('puts every sort key in exactly one slice, whatever its format', () => {
    for (const key of keys) {
      expect([key, slices.filter((slice) => sliceHasKey(slice, key)).length]).toEqual([key, 1]);
    }
  });

  it('opens and closes each type with catch-all slices', () => {
    expect(slices[0]).toEqual({ type: 'u', to: EARLIEST });
    expect(slices.at(-1)).toEqual({ type: 'u', from: LATEST });
    expect(slices.at(-2)?.to).toBe(LATEST);
  });
});
