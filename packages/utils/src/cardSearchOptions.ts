/**
 * Card search options that both the search page and the search API have to agree on.
 *
 * These lived as separate copies in the client and in each server entry point, which is how
 * the client's "printing" drifted from the server's "printings": nothing compared the two, so
 * a select rendered the wrong label while the api happily returned the other mode.
 */

export const DISTINCT_MODES = ['names', 'printings'] as const;

/** One row per card name, or one row per printing. */
export type Distinct = (typeof DISTINCT_MODES)[number];

/**
 * Clamp a query param to a real mode.
 *
 * An absent param means the default ("names"); anything else present but unrecognized reads as
 * "printings", because that is what the search itself does — it only ever tests for "names".
 */
export const toDistinct = (value?: string | null): Distinct => {
  if (value === undefined || value === null) {
    return 'names';
  }
  return value === 'names' ? 'names' : 'printings';
};
