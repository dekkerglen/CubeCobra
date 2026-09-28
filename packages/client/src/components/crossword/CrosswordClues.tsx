import React from 'react';

import classNames from 'classnames';

import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

import { CrosswordDisplaySlot } from './crosswordShape';

export interface CrosswordClueBarProps {
  activeSlot: CrosswordDisplaySlot | null;
}

/**
 * The active clue, repeated above the grid — on a phone the lists are too far down
 * the page to glance at.
 */
export const CrosswordClueBar: React.FC<CrosswordClueBarProps> = ({ activeSlot }) => (
  <Flexbox direction="row" gap="2" alignItems="baseline" className="min-h-[2.5rem] px-1">
    <Text sm semibold className="shrink-0 text-text-secondary">
      {activeSlot ? `${activeSlot.number}${activeSlot.direction === 'across' ? 'A' : 'D'}` : '—'}
    </Text>
    <Text sm className="min-w-0 break-words">
      {activeSlot?.clue ?? 'Tap a square to start.'}
    </Text>
  </Flexbox>
);

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
