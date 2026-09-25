import React from 'react';

import { ManaMatrixPuzzle, ManaMatrixSubmission } from '@utils/datatypes/ManaMatrix';
import classNames from 'classnames';

import { CategoryHeader } from 'components/manamatrix/ManaMatrixGrid';
import useCardArt from 'components/manamatrix/useCardArt';

interface PreviewCellProps {
  answer: string;
  solved: boolean;
  missed: boolean;
  unionText: string;
  count: number;
}

const PreviewCell: React.FC<PreviewCellProps> = ({ answer, solved, missed, unionText, count }) => {
  const artUrl = useCardArt(answer);

  return (
    <div
      className={classNames('relative aspect-square w-full overflow-hidden rounded-md border-2 bg-bg', {
        'border-border': !solved && !missed,
        'border-green-500': solved,
        'border-red-500': missed,
      })}
    >
      {artUrl && <img src={artUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}

      {answer ? (
        <div className="absolute inset-x-0 bottom-0 bg-black/75 px-1.5 py-0.5 text-left">
          <span className="block truncate text-xs font-semibold text-white">{answer}</span>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 flex items-center justify-center p-2 pb-5">
            <span className="text-2xl font-light text-text-secondary md:hidden">+</span>
            <span className="hidden max-h-full overflow-hidden text-center text-xs leading-snug text-text-secondary md:block">
              {unionText}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-1 text-center text-xs leading-none text-text-secondary">
            {count.toLocaleString()} cards
          </div>
        </>
      )}
    </div>
  );
};

export interface ManaMatrixBoardPreviewProps {
  puzzle: ManaMatrixPuzzle;
  submission?: ManaMatrixSubmission | null;
}

/**
 * Non-interactive rendering of a puzzle board, laid out exactly like the game
 * grid: category headers plus 3x3 cells showing the player's answers (when
 * they've played) or each cell's combined requirement. Used in the archive,
 * where the whole board sits inside the row's link.
 */
const ManaMatrixBoardPreview: React.FC<ManaMatrixBoardPreviewProps> = ({ puzzle, submission }) => {
  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-[repeat(4,minmax(0,1fr))] gap-1.5 sm:grid-cols-[minmax(4rem,7rem)_repeat(3,minmax(0,1fr))]">
      <div />
      {puzzle.columns.map((category, col) => (
        <CategoryHeader key={`col-${col}`} category={category} />
      ))}

      {puzzle.rows.map((category, row) => (
        <React.Fragment key={`row-${row}`}>
          <CategoryHeader category={category} />
          {[0, 1, 2].map((col) => {
            const answer = submission?.answers?.[row]?.[col] ?? '';
            const solved = submission ? submission.correct?.[row]?.[col] === true : false;
            const missed = !!submission && !solved && answer.trim().length > 0;

            return (
              <PreviewCell
                key={`cell-${row}-${col}`}
                answer={answer}
                solved={solved}
                missed={missed}
                unionText={`${category.description} and ${puzzle.columns[col]?.description ?? ''}`}
                count={puzzle.counts[row]?.[col] ?? 0}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

export default ManaMatrixBoardPreview;
