// Shared fuzzy matcher for resolving noisy OCR text against known card names.
// Used on the client (against a cube's bounded pool) and on the server (against
// the full catalog), so the scores produced by each are directly comparable.

// Strip diacritics, punctuation, and casing so "Æther Vial" ~ "aether vial" and
// stray mana glyphs misread as punctuation have less weight.
export const normalizeForMatch = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Levenshtein distance with a single rolling row.
const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
};

const ratio = (a: string, b: string): number => {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
};

// Similarity (0..1) between two already-normalized strings, with a bonus when
// the query is a clean prefix of the candidate (OCR often clips the end of a
// name where the mana cost sits).
export const scoreNormalized = (queryNorm: string, candidateNorm: string): number => {
  let score = ratio(queryNorm, candidateNorm);
  if (queryNorm.length >= 4 && candidateNorm.startsWith(queryNorm)) {
    score = Math.max(score, 0.8 + 0.2 * (queryNorm.length / candidateNorm.length));
  }
  return score;
};

// Similarity between two raw (un-normalized) strings.
export const scoreMatch = (query: string, candidate: string): number =>
  scoreNormalized(normalizeForMatch(query), normalizeForMatch(candidate));

export interface CardMatch {
  name: string; // original (non-normalized) card name
  score: number; // 0..1 confidence
}

// A pool prepared once per scan: original names paired with their normalized
// form, so each query doesn't re-normalize the whole pool.
export interface PreparedPool {
  name: string;
  normalized: string;
}

export const preparePool = (names: string[]): PreparedPool[] =>
  names.map((name) => ({ name, normalized: normalizeForMatch(name) }));

// Best fuzzy match for one query against a prepared pool.
export const bestMatch = (query: string, pool: PreparedPool[]): CardMatch | null => {
  const normalized = normalizeForMatch(query);
  if (!normalized || pool.length === 0) {
    return null;
  }

  let best: CardMatch | null = null;
  for (const entry of pool) {
    const score = scoreNormalized(normalized, entry.normalized);
    if (!best || score > best.score) {
      best = { name: entry.name, score };
    }
  }
  return best;
};

// Best fuzzy match over a raw names array (normalizes each candidate). Suited to
// short shortlists; for large/repeated pools prepare once with preparePool.
export const bestMatchFromNames = (query: string, names: string[]): CardMatch | null =>
  bestMatch(query, preparePool(names));
