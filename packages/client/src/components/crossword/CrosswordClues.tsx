import React from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from '@primer/octicons-react';
import classNames from 'classnames';

import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

import { CrosswordDisplaySlot } from './crosswordShape';
import { CrosswordSolver } from './useCrosswordSolver';

interface ClueStepButtonProps {
  label: string;
  onStep: () => void;
  children: React.ReactNode;
}

const ClueStepButton: React.FC<ClueStepButtonProps> = ({ label, onStep, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    // preventDefault on mousedown keeps the capture input focused, since losing it
    // takes the soft keyboard down with it. The click still fires, so unlike a
    // mousedown handler this is also reachable from a keyboard.
    onMouseDown={(event) => event.preventDefault()}
    onClick={onStep}
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-text-secondary hover:bg-bg-active hover:text-text"
  >
    {children}
  </button>
);

export interface CrosswordClueBarProps {
  solver: CrosswordSolver;
}

/**
 * The active clue, repeated under the grid, with the controls for walking between
 * clues.
 *
 * Under rather than over the grid: on a phone this puts it in the strip directly
 * above the soft keyboard, which is where the eye already is while typing and the
 * only part of a tall page a thumb can reach. The arrows are the only way back
 * through the clues without a Shift key, and they are what the solver asked for.
 */
export const CrosswordClueBar: React.FC<CrosswordClueBarProps> = ({ solver }) => {
  const { activeSlot, clueBarRef, previousClue, nextClue } = solver;
  return (
    // A plain div rather than Flexbox because the scroll fit needs a ref on it, and
    // it measures this element's real height — a clue long enough to wrap makes the
    // bar taller and takes that room off the grid.
    <div ref={clueBarRef} className="flex min-h-[2.5rem] max-w-full flex-row items-center gap-2 px-1">
      <Flexbox direction="row" gap="2" alignItems="baseline" className="min-w-0 flex-1">
        <Text sm semibold className="shrink-0 text-text-secondary">
          {activeSlot ? `${activeSlot.number}${activeSlot.direction === 'across' ? 'A' : 'D'}` : '—'}
        </Text>
        <Text sm className="min-w-0 break-words">
          {activeSlot?.clue ?? 'Tap a square to start.'}
        </Text>
      </Flexbox>
      <ClueStepButton label="Previous clue" onStep={previousClue}>
        <ChevronLeftIcon size={16} />
      </ClueStepButton>
      <ClueStepButton label="Next clue" onStep={nextClue}>
        <ChevronRightIcon size={16} />
      </ClueStepButton>
    </div>
  );
};

export interface CrosswordClueListProps {
  slots: CrosswordDisplaySlot[];
  heading: string;
  activeSlotId?: string;
  onSelect: (slot: CrosswordDisplaySlot) => void;
  /** Show the Scryfall filter under the clue. The lab does; the game doesn't. */
  showFilter?: boolean;
  /** Slots whose answer is fully filled in, drawn back. */
  completedSlotIds?: Set<string>;
  className?: string;
}

export const CrosswordClueList: React.FC<CrosswordClueListProps> = ({
  slots,
  heading,
  activeSlotId,
  onSelect,
  showFilter = false,
  completedSlotIds,
  className,
}) => (
  <Flexbox direction="col" gap="1" className={classNames('min-w-0 flex-1', className)}>
    <Text sm semibold className="uppercase tracking-wide text-text-secondary">
      {heading}
    </Text>
    {slots.map((slot) => (
      <button
        key={slot.id}
        type="button"
        onMouseDown={(event) => {
          // Don't let the click blur the capture input; the grid does the same.
          event.preventDefault();
          onSelect(slot);
        }}
        className={classNames('flex w-full gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-bg-active', {
          'bg-amber-300/20 font-semibold': activeSlotId === slot.id,
          'text-text-secondary': completedSlotIds?.has(slot.id) && activeSlotId !== slot.id,
        })}
      >
        <span className="w-6 shrink-0 text-right text-text-secondary">{slot.number}</span>
        <span className="min-w-0 break-words">
          {slot.clue ?? '(no clue)'} <span className="whitespace-nowrap text-text-secondary">({slot.length})</span>
          {/* The filter the clue above is a translation of, for the four classes
              clued by one. Secondary text: the English is the clue, the syntax is
              there for a solver who prefers to read it that way. */}
          {showFilter && slot.clueFilter && (
            <span className="block font-mono text-xs text-text-secondary">{slot.clueFilter}</span>
          )}
        </span>
      </button>
    ))}
  </Flexbox>
);
