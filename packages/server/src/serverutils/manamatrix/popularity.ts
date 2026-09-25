import { ManaMatrixCellPopularity, ManaMatrixCellStats, ManaMatrixSubmission } from '@utils/datatypes/ManaMatrix';

/**
 * Builds the 3x3 popularity grid for a set of answered cell names: how many
 * players gave the same (correct) answer, out of all counted answers for that
 * cell. Cells without a counted name — or whose stats item is missing/empty —
 * stay null.
 */
export const popularityGrid = (
  cellStats: (ManaMatrixCellStats | undefined)[][],
  names: (string | null)[][],
): (ManaMatrixCellPopularity | null)[][] => {
  const grid: (ManaMatrixCellPopularity | null)[][] = Array.from({ length: 3 }, () => [null, null, null]);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const name = names[row]?.[col];
      const stats = cellStats[row]?.[col];
      if (!name || !stats || stats.totalAnswers === 0) {
        continue;
      }

      const count = stats.answerCounts[name] ?? 0;
      grid[row]![col] = {
        count,
        total: stats.totalAnswers,
        percentage: Math.round((1000 * count) / stats.totalAnswers) / 10,
      };
    }
  }

  return grid;
};

/** The counted answer names of a stored submission, as a 3x3 grid. */
export const countedNamesGrid = (submission: ManaMatrixSubmission | undefined): (string | null)[][] => {
  const grid: (string | null)[][] = Array.from({ length: 3 }, () => [null, null, null]);
  if (!submission) {
    return grid;
  }

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      grid[row]![col] = submission.countedCells[`${row},${col}`] ?? null;
    }
  }

  return grid;
};
