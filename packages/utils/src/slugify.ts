/**
 * Normalizes a user-authored label (a primer tab title, a view name) into a slug
 * suitable for query-param navigation.
 *
 * The result holds only letters, numbers and single separating dashes, so a value
 * written with URLSearchParams survives the round trip back out unchanged rather
 * than picking up a second layer of percent-encoding.
 */
export const slugify = (value: string): string =>
  value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
