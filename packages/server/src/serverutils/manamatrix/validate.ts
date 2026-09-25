import { isExtraCard } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';
import { FilterFunction, makeFilter } from '@utils/filtering/FilterCards';
import { cardFromId, getIdsFromName } from 'serverutils/carddb';

export interface ManaMatrixValidation {
  correct: boolean[][];
  // Canonical normalized card name per correct cell (null otherwise); used to
  // dedupe popularity counting server-side.
  matchedNames: (string | null)[][];
  // Canonical printed card name per correct cell (null otherwise); replaces
  // the user's raw input in stored/displayed answers ("pestermite" -> "Pestermite").
  displayNames: (string | null)[][];
}

export interface CompiledPuzzleFilters {
  columns: FilterFunction[];
  rows: FilterFunction[];
}

// Compiled filters per puzzle date. Submissions overwhelmingly target the
// active day (plus the occasional archive play), so a handful of entries is
// plenty; oldest entries are evicted first.
const MAX_CACHED_PUZZLES = 8;
const compiledCache = new Map<string, CompiledPuzzleFilters>();

const compile = (filterText: string): FilterFunction => {
  const { err, filter } = makeFilter(filterText);
  if (err || !filter) {
    throw new Error(`Stored ManaMatrix category no longer parses: ${filterText}`);
  }
  return filter;
};

export const compilePuzzleFilters = (puzzle: ManaMatrixPuzzle): CompiledPuzzleFilters => {
  const cached = compiledCache.get(puzzle.date);
  if (cached) {
    return cached;
  }

  const compiled: CompiledPuzzleFilters = {
    columns: puzzle.columns.map((category) => compile(category.filterText)),
    rows: puzzle.rows.map((category) => compile(category.filterText)),
  };

  compiledCache.set(puzzle.date, compiled);
  if (compiledCache.size > MAX_CACHED_PUZZLES) {
    const oldest = compiledCache.keys().next().value;
    if (oldest !== undefined) {
      compiledCache.delete(oldest);
    }
  }

  return compiled;
};

/**
 * Validates a 3x3 grid of answers against the puzzle's filters. An answer is
 * correct when at least ONE non-extra printing of the named card satisfies
 * both the cell's row and column filter — the same printing must pass both
 * (this matters for printing-specific filters like set: and atag:).
 *
 * Name resolution goes through getIdsFromName, which already handles case,
 * accents, surrounding quotes, and split/double-faced card names.
 */
export const validateAnswers = (puzzle: ManaMatrixPuzzle, answers: (string | null)[][]): ManaMatrixValidation => {
  const { columns, rows } = compilePuzzleFilters(puzzle);

  const correct: boolean[][] = Array.from({ length: 3 }, () => [false, false, false]);
  const matchedNames: (string | null)[][] = Array.from({ length: 3 }, () => [null, null, null]);
  const displayNames: (string | null)[][] = Array.from({ length: 3 }, () => [null, null, null]);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const answer = answers[row]?.[col];
      if (!answer || answer.trim().length === 0) {
        continue;
      }

      for (const id of getIdsFromName(answer)) {
        const details = cardFromId(id);
        if (details.error || isExtraCard(details)) {
          continue;
        }

        const card = { details } as Card;
        if (columns[col]!(card) && rows[row]!(card)) {
          correct[row]![col] = true;
          matchedNames[row]![col] = details.name_lower;
          displayNames[row]![col] = details.name;
          break;
        }
      }
    }
  }

  return { correct, matchedNames, displayNames };
};

/** Test seam: clear the compiled-filter cache. */
export const clearCompiledFilterCache = (): void => {
  compiledCache.clear();
};
