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
  // The per-row select keeps its space in Text view (just hidden), and sits on the far side of the toggle
  // from the row's anchor: before it on desktop, where the actions are right-aligned, and after it on phones,
  // where they are left-aligned. Either way switching views never moves the toggle.
  <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
    <div
      className={classNames('w-44 order-last md:order-first', { invisible: view !== 'cards' })}
      aria-hidden={view !== 'cards'}
    >
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
