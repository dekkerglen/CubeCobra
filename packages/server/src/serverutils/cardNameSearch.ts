import uFuzzy from '@leeoniya/ufuzzy';
import { normalizeName } from '@utils/cardutil';

// Substring fallback for card-name autocomplete. uFuzzy's defaults already match
// what we want here: contiguous matches within a term (intraIns 0) found
// anywhere in the string (BoundMode.Any). We run it over an alpha-only
// projection of the catalog so spaces, commas, apostrophes and digits don't get
// in the way — e.g. "moonsage" finds "Tamiyo, the Moon Sage".
const uf = new uFuzzy({ intraIns: 0 });

const NON_ALPHA = /[^a-z]/g;

// Lowercase + strip diacritics (normalizeName), then drop everything that isn't
// an a–z letter.
export const normalizeAlpha = (value: string): string => normalizeName(value).replace(NON_ALPHA, '');

// Alpha-only haystacks are derived from the catalog name arrays on first use and
// cached by array identity. The catalog replaces these arrays whenever it
// (re)loads, yielding new references, so stale entries fall out of the WeakMap
// on their own.
const alphaHaystacks = new WeakMap<string[], string[]>();

const getAlphaHaystack = (names: string[]): string[] => {
  let haystack = alphaHaystacks.get(names);
  if (!haystack) {
    haystack = names.map(normalizeAlpha);
    alphaHaystacks.set(names, haystack);
  }
  return haystack;
};

// Ranked substring matches over `names`, skipping anything already in `exclude`
// and capped at `limit`. Returned values come from the original `names` array
// (the alpha-only form is only used for matching).
export function substringMatches(names: string[], alphaNeedle: string, limit: number, exclude: Set<string>): string[] {
  if (limit <= 0 || alphaNeedle.length === 0) {
    return [];
  }

  const haystack = getAlphaHaystack(names);
  const [idxs, info, order] = uf.search(haystack, alphaNeedle);
  if (!idxs) {
    return [];
  }

  // uFuzzy ranks results when the match set is small enough; for very large
  // match sets it skips ranking and returns filter order (info/order null).
  const ranked = info && order ? order.map((o) => info.idx[o]!) : idxs;

  const out: string[] = [];
  for (let i = 0; i < ranked.length && out.length < limit; i += 1) {
    const name = names[ranked[i]!]!;
    if (!exclude.has(name)) {
      out.push(name);
    }
  }
  return out;
}
