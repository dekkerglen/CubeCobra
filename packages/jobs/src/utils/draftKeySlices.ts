// Partitions each draft type's GSI4 sort keys (`DATE#<date>`) into slices the export reads in
// parallel. The keys compare as strings, and uploads carry user-entered dates (negative, 12-digit,
// years ahead), so the slices can't assume clean 13-digit timestamps: they use fixed 13-digit
// boundaries, each slice excludes its upper bound, and one slice takes every key below the first
// boundary and one every key from the last. Together they cover every key exactly once.

export interface DraftKeySlice {
  type: string;
  from?: number;
  to?: number;
}

export const draftKey = (date: unknown): string => `DATE#${date}`;

export const buildDraftKeySlices = (
  types: string[],
  earliest: number,
  latest: number,
  sliceMs: number,
): DraftKeySlice[] =>
  types.flatMap((type) => {
    const slices: DraftKeySlice[] = [{ type, to: earliest }];
    for (let from = earliest; from < latest; from += sliceMs) {
      slices.push({ type, from, to: Math.min(from + sliceMs, latest) });
    }
    slices.push({ type, from: latest });
    return slices;
  });

/**
 * Whether a key belongs to the slice. The DynamoDB query includes both bounds; the export drops
 * keys equal to the upper bound, which belong to the next slice.
 */
export const sliceHasKey = (slice: DraftKeySlice, key: string): boolean =>
  (slice.from === undefined || key >= draftKey(slice.from)) && (slice.to === undefined || key < draftKey(slice.to));
