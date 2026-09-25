import React from 'react';

import { ManaMatrixCategory, ManaMatrixCellPopularity, ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';
import ManaMatrixTile from 'components/manamatrix/ManaMatrixTile';

export const CategoryHeader: React.FC<{
  category: ManaMatrixCategory;
  onClick?: () => void;
}> = ({ category, onClick }) => {
  // Boxed like the tiles so labels read as part of the board (and on mobile
  // they ARE tiles: the grid is four equal columns there).
  const classes =
    'flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-md border-2 border-border bg-bg p-1 text-center';

  // Desktop shows the translation, phones the (shorter) raw filter syntax —
  // one style, no nested chip. Tapping the label opens a modal with both
  // (when a handler is wired up).
  const content = (
    <>
      <span className="hidden text-xs font-semibold leading-tight sm:block sm:text-sm">{category.description}</span>
      <span className="max-w-full break-words text-xs font-semibold leading-tight sm:hidden">
        {category.filterText}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${category.description} (${category.filterText})`}
        className={classes}
      >
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
};

export interface ManaMatrixGridProps {
  puzzle: ManaMatrixPuzzle;
  values: string[][];
  // Per cell: true = solved, false = checked and wrong, null = not yet checked
  // (empty, or edited since the last check). Whole grid null before first check.
  correct: (boolean | null)[][] | null;
  // A check is in flight: filled, unsolved tiles show a spinner badge.
  submitting?: boolean;
  popularity: (ManaMatrixCellPopularity | null)[][] | null;
  onCellClick: (row: number, col: number) => void;
  onCategoryClick?: (category: ManaMatrixCategory) => void;
}

const ManaMatrixGrid: React.FC<ManaMatrixGridProps> = ({
  puzzle,
  values,
  correct,
  submitting = false,
  popularity,
  onCellClick,
  onCategoryClick,
}) => {
  return (
    // Capped width so the whole 3x3 board fits on one screen. Mobile: four
    // equal columns (labels are board squares); desktop: narrower label column
    // so the description-bearing headers don't steal tile space.
    <div className="mx-auto grid w-full max-w-2xl grid-cols-[repeat(4,minmax(0,1fr))] gap-1.5 sm:grid-cols-[minmax(4.5rem,8rem)_repeat(3,minmax(0,1fr))]">
      {/* Corner spacer + column categories */}
      <div />
      {puzzle.columns.map((category, col) => (
        <CategoryHeader
          key={`col-${col}`}
          category={category}
          onClick={onCategoryClick && (() => onCategoryClick(category))}
        />
      ))}

      {puzzle.rows.map((category, row) => (
        <React.Fragment key={`row-${row}`}>
          <CategoryHeader category={category} onClick={onCategoryClick && (() => onCategoryClick(category))} />
          {[0, 1, 2].map((col) => {
            const value = values[row]?.[col] ?? '';
            const cellCorrect = correct ? (correct[row]?.[col] ?? null) : null;
            return (
              <ManaMatrixTile
                key={`cell-${row}-${col}`}
                value={value}
                count={puzzle.counts[row]?.[col] ?? 0}
                correct={cellCorrect}
                // Only unchecked answers are actually being judged — known-wrong
                // cells with an unchanged answer keep their X.
                checking={submitting && cellCorrect === null && value.trim().length > 0}
                popularity={popularity?.[row]?.[col] ?? null}
                columnDescription={puzzle.columns[col]?.description ?? ''}
                rowDescription={category.description}
                onClick={() => onCellClick(row, col)}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

export default ManaMatrixGrid;
