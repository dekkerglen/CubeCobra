import Card from '@utils/datatypes/Card';
import { ManaMatrixCellAnalysis, ManaMatrixCellStats, ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';
import catalog from 'serverutils/cardCatalog';
import { canonicalPrintingForName } from 'serverutils/cardPrintings';

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
  // Per cell: canonical normalized name -> canonical printed name. Same
  // per-printing semantics as generation and validation.
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

    // Under the card's real name, so a reskin doesn't list as a second card the
    // player has never heard of ("Party Tree" for The Great Henge). The printing
    // that passed the filters is still what made the card valid — only the name
    // shown is canonicalised, exactly as in validateAnswers.
    const canonical = canonicalPrintingForName(details.name_lower) ?? details;

    for (let row = 0; row < 3; row++) {
      if (!rowPasses[row]) continue;
      for (let col = 0; col < 3; col++) {
        if (columnPasses[col]) {
          cellNames[row]![col]!.set(canonical.name_lower, canonical.name);
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
 * Recorded answer tallies re-keyed onto canonical card names, so a cell that was
 * answered under two names of the same card reports one total.
 *
 * Stored tallies are keyed by whatever name the answer was accepted under, and
 * before validateAnswers canonicalised that, a reskin's name went in as itself.
 * Folding on read means those guesses land on the card they were guesses for
 * rather than vanishing with the name they were filed under.
 */
const foldAnswerCounts = (answerCounts: Record<string, number>): Map<string, number> => {
  const folded = new Map<string, number>();
  for (const [nameLower, guesses] of Object.entries(answerCounts)) {
    const key = canonicalPrintingForName(nameLower)?.name_lower ?? nameLower;
    folded.set(key, (folded.get(key) ?? 0) + guesses);
  }
  return folded;
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
      const counts = foldAnswerCounts(stats?.answerCounts ?? {});
      const totalGuesses = stats?.totalAnswers ?? 0;

      const validCards = [...names.entries()]
        .map(([normalized, name]) => {
          const guesses = counts.get(normalized) ?? 0;
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
