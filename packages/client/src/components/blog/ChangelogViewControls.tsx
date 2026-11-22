import React from 'react';

import classNames from 'classnames';

import { ChangelogView } from 'hooks/useChangelogView';

import { NumCols } from '../base/Layout';
import { CardsPerRowSelect } from '../cube/CubeViewSwitcher';

const VIEWS: { key: ChangelogView; label: string }[] = [
  { key: 'text', label: 'Text' },
  { key: 'cards', label: 'Cards' },
];

export interface ChangelogViewControlsProps {
  view: ChangelogView;
  setView: (view: ChangelogView) => void;
  cardsPerRow: NumCols;
  setCardsPerRow: (n: NumCols) => void;
}

const ChangelogViewControls: React.FC<ChangelogViewControlsProps> = ({
  view,
  setView,
  cardsPerRow,
  setCardsPerRow,
}) => (
  // The per-row select sits before the toggle and keeps its space in Text view (just hidden), so switching
  // views never moves the toggle.
  <div className="flex flex-wrap items-center justify-end gap-2">
    <div className={classNames('w-44', { invisible: view !== 'cards' })} aria-hidden={view !== 'cards'}>
      <CardsPerRowSelect value={cardsPerRow} setValue={setCardsPerRow} />
    </div>
    <div className="flex gap-0 bg-bg-active rounded py-0.5 px-1 items-center">
      {VIEWS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => setView(key)}
          className={classNames(
            'px-2 py-1 rounded text-sm transition-colors',
            view === key ? 'bg-button-primary text-white' : 'hover:bg-bg text-text',
          )}
          aria-pressed={view === key}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
);

export default ChangelogViewControls;
