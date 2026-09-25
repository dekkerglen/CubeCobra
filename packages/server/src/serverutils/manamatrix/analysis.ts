import Card from '@utils/datatypes/Card';
import { ManaMatrixCellAnalysis, ManaMatrixCellStats, ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';
import catalog from 'serverutils/cardCatalog';

import { compilePuzzleFilters } from './validate';

// The valid-answer sets for a puzzle require a full catalog pass, so cache
// them per date (the sets only change with a catalog reload); guess counts are
// merged in fresh on every request.
const MAX_CACHED_PUZZLES = 4;
const validNamesCache = new Map<string, Map<string, string>[][]>();

const computeValidNames = (puzzle: ManaMatrixPuzzle): Map<string, string>[][] => {
  const cached = validNamesCache.get(puzzle.date);
  if (cached) {
    return cached;
  }

  const { columns, rows } = compilePuzzleFilters(puzzle);
  // Per cell: normalized name -> canonical printed name. Same per-printing
  // semantics as generation and validation.
  const cellNames: Map<string, string>[][] = Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => new Map<string, string>()),
  );

  for (const details of catalog.printedCardList) {
    const card = { details } as Card;

    const columnPasses = columns.map((filter) => filter(card));
    if (!columnPasses.some(Boolean)) {
      continue;
    }
    const rowPasses = rows.map((filter) => filter(card));
    if (!rowPasses.some(Boolean)) {
      continue;
    }

    for (let row = 0; row < 3; row++) {
      if (!rowPasses[row]) continue;
      for (let col = 0; col < 3; col++) {
        if (columnPasses[col]) {
          cellNames[row]![col]!.set(details.name_lower, details.name);
        }
      }
    }
  }

  validNamesCache.set(puzzle.date, cellNames);
  if (validNamesCache.size > MAX_CACHED_PUZZLES) {
    const oldest = validNamesCache.keys().next().value;
    if (oldest !== undefined) {
      validNamesCache.delete(oldest);
    }
  }

  return cellNames;
};

/**
 * Every valid answer for each cell, with how often the community actually
 * gave it (sorted most-guessed first, then alphabetically).
 */
export const analyzePuzzle = (
  puzzle: ManaMatrixPuzzle,
  cellStats: (ManaMatrixCellStats | undefined)[][],
): ManaMatrixCellAnalysis[][] => {
  const validNames = computeValidNames(puzzle);

  return validNames.map((rowNames, row) =>
    rowNames.map((names, col) => {
      const stats = cellStats[row]?.[col];
      const counts = stats?.answerCounts ?? {};
      const totalGuesses = stats?.totalAnswers ?? 0;

      const validCards = [...names.entries()]
        .map(([normalized, name]) => {
          const guesses = counts[normalized] ?? 0;
          return {
            name,
            guesses,
            percentage: totalGuesses > 0 ? Math.round((1000 * guesses) / totalGuesses) / 10 : 0,
          };
        })
        .sort((a, b) => b.guesses - a.guesses || a.name.localeCompare(b.name));

      return { totalGuesses, totalCards: validCards.length, validCards };
    }),
  );
};

/** Test seam: drop the cache so a rebuilt catalog is re-scanned. */
export const clearAnalysisCache = (): void => {
  validNamesCache.clear();
};
