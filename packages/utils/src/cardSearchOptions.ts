export const DISTINCT_MODES = ['names', 'printings'] as const;

export type Distinct = (typeof DISTINCT_MODES)[number];

// Absent means "names"; any other value reads as "printings", matching the search itself.
export const toDistinct = (value?: string | null): Distinct => {
  if (value === undefined || value === null) {
    return 'names';
  }
  return value === 'names' ? 'names' : 'printings';
};
