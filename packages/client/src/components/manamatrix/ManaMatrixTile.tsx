import React from 'react';

import { CheckCircleFillIcon, XCircleFillIcon } from '@primer/octicons-react';
import { ManaMatrixCellPopularity } from '@utils/datatypes/ManaMatrix';
import classNames from 'classnames';

import Spinner from 'components/base/Spinner';
import useCardArt from 'components/manamatrix/useCardArt';

export interface ManaMatrixTileProps {
  value: string;
  count: number;
  // null before the first submission; then whether this cell is solved.
  correct: boolean | null;
  // This cell's answer is part of an in-flight check.
  checking?: boolean;
  popularity: ManaMatrixCellPopularity | null;
  columnDescription: string;
  rowDescription: string;
  onClick: () => void;
}

const ManaMatrixTile: React.FC<ManaMatrixTileProps> = ({
  value,
  count,
  correct,
  checking = false,
  popularity,
  columnDescription,
  rowDescription,
  onClick,
}) => {
  // Best-effort art crop for the entered card; the tile works fine without it.
  const artUrl = useCardArt(value);

  const solved = correct === true;
  const missed = correct === false;

  const cellLabel = `${rowDescription}, and ${columnDescription}`;
  const ariaLabel = value
    ? `${value}${checking ? ', checking' : solved ? ', correct' : missed ? ', incorrect' : ''} — ${cellLabel}`
    : `Pick a card — ${cellLabel}`;

  return (
    <button
      type="button"
      onClick={() => {
        if (!solved) {
          onClick();
        }
      }}
      aria-disabled={solved}
      aria-label={ariaLabel}
      className={classNames(
        'relative aspect-square w-full overflow-hidden rounded-md border-2 bg-bg transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        {
          'border-border hover:border-border-secondary cursor-pointer': correct === null,
          'border-green-500 cursor-default': solved,
          'border-red-500 hover:border-red-400 cursor-pointer': missed,
        },
      )}
    >
      {artUrl && <img src={artUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}

      {(checking || solved || missed) && (
        <div className="absolute left-1 top-1 leading-none">
          {checking ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/70">
              <Spinner sm className="text-white" />
            </span>
          ) : solved ? (
            <CheckCircleFillIcon size={20} className="block text-green-500" />
          ) : (
            <XCircleFillIcon size={20} className="block text-red-500" />
          )}
        </div>
      )}

      {value ? (
        <div className="absolute inset-x-0 bottom-0 bg-black/75 px-1.5 py-0.5 text-left">
          <span className="block truncate text-xs font-semibold text-white">{value}</span>
          {popularity && (
            <span className="block truncate text-xs leading-tight text-white/90">
              {popularity.percentage}% answered this ({popularity.count}/{popularity.total})
            </span>
          )}
        </div>
      ) : (
        <>
          <div className="absolute inset-0 flex items-center justify-center p-2 pb-5">
            {/* Mobile tiles are too small for prose; show the union text on desktop only. */}
            <span className="text-2xl font-light text-text-secondary md:hidden">+</span>
            <span className="hidden max-h-full overflow-hidden text-center text-xs leading-snug text-text-secondary md:block">
              {/* Reads as one compiled filter expression: "<row> and <col>" is
                  exactly what the translator produces for the joined clauses. */}
              {rowDescription} and {columnDescription}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-1 text-center text-xs leading-none text-text-secondary">
            {count.toLocaleString()} {count === 1 ? 'card' : 'cards'}
          </div>
        </>
      )}
    </button>
  );
};

export default ManaMatrixTile;
