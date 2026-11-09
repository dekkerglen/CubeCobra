import React, { useState } from 'react';

import { Match } from '@utils/datatypes/Record';
import { BYE } from '@utils/records/pairings';
import classNames from 'classnames';

import Text from 'components/base/Text';

import { Seat, SeatedPlayer } from './seating';

// Seat one sits at the top of the table and the seats run clockwise from there, the way packs
// are passed left; paired across the table, the chair straight across is the one it meets.
const seatPosition = (index: number, count: number, radius: number) => {
  const angle = ((index / count) * 2 - 0.5) * Math.PI;
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
};
const SEAT_RADIUS = 40;

interface SeatingTableProps {
  seats: Seat[];
  // A round's pairings, drawn as a line between each pair of chairs, or null to draw none.
  pairings: Match[] | null;
  selected: number | null;
  onSelect: (index: number) => void;
  // Lets a seated player be dragged onto another chair; without it, chairs don't drag.
  onSwap?: (from: number, to: number) => void;
  // What the middle of the table says.
  center: React.ReactNode;
  // A line under a player's name, such as their record.
  detail?: (player: SeatedPlayer) => React.ReactNode;
  // A player who is seated but out of the event, shown faded.
  isInactive?: (player: SeatedPlayer) => boolean;
}

/**
 * A round table with a chair per seat, numbered clockwise from the top, and a line across it
 * between each pair of players. Shared by setting the table and pairing a round, so a pod sees
 * the same picture in both.
 */
const SeatingTable: React.FC<SeatingTableProps> = ({
  seats,
  pairings,
  selected,
  onSelect,
  onSwap,
  center,
  detail,
  isInactive,
}) => {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const seatWidth = seats.length <= 8 ? 'w-20' : seats.length <= 12 ? 'w-16' : 'w-14';
  const seatOf = (name: string) => seats.findIndex((seat) => seat.player?.name === name);
  const selectedName = selected === null ? undefined : seats[selected]?.player?.name;

  // A match can name someone who isn't seated (an unknown opponent typed into the list); it has
  // no chair to draw a line to.
  const lines = (pairings ?? [])
    .filter((match) => seatOf(match.p1) >= 0 && seatOf(match.p2) >= 0)
    .map((match) => ({
      from: seatPosition(seatOf(match.p1), seats.length, SEAT_RADIUS - 8),
      to: seatPosition(seatOf(match.p2), seats.length, SEAT_RADIUS - 8),
      highlighted: selectedName !== undefined && (match.p1 === selectedName || match.p2 === selectedName),
    }));
  const byes = new Set(
    (pairings ?? []).flatMap((match) => (match.p2 === BYE ? [match.p1] : match.p1 === BYE ? [match.p2] : [])),
  );

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
      <div className="absolute inset-[22%] rounded-full border-2 border-border bg-bg-active shadow-inner" />
      {lines.length > 0 && (
        <svg className="absolute inset-0 h-full w-full text-button-primary" viewBox="0 0 100 100" aria-hidden="true">
          {lines.map((line, index) => (
            <line
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x1={line.from.x}
              y1={line.from.y}
              x2={line.to.x}
              y2={line.to.y}
              stroke="currentColor"
              strokeWidth={line.highlighted ? 0.8 : 0.4}
              strokeDasharray="2 1.5"
              opacity={selectedName === undefined || line.highlighted ? 1 : 0.25}
            />
          ))}
        </svg>
      )}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{center}</div>
      {seats.map((seat, index) => {
        const { x, y } = seatPosition(index, seats.length, SEAT_RADIUS);
        const isSelected = index === selected;
        const inactive = Boolean(seat.player && isInactive?.(seat.player));
        return (
          <button
            // Chairs are positional: seat three is seat three whoever sits in it.
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            type="button"
            draggable={Boolean(onSwap && seat.player)}
            onDragStart={() => setDragFrom(index)}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={(event) => {
              if (dragFrom !== null) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragFrom !== null && onSwap) {
                onSwap(dragFrom, index);
                setDragFrom(null);
              }
            }}
            onClick={() => onSelect(index)}
            aria-pressed={isSelected}
            aria-label={`Seat ${index + 1}: ${seat.player ? seat.player.name : 'empty'}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            className={classNames(
              'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-lg border-2 px-1 py-1 transition-colors',
              seatWidth,
              {
                'border-button-primary bg-bg-active': isSelected,
                'border-border bg-bg hover:bg-bg-active': !isSelected && seat.player,
                'border-dashed border-border bg-bg text-text-secondary hover:bg-bg-active': !isSelected && !seat.player,
                'opacity-50': dragFrom === index || inactive,
              },
            )}
          >
            <span className="text-[10px] leading-tight text-text-secondary">{index + 1}</span>
            <span className="w-full truncate text-center text-xs font-medium leading-tight">
              {seat.player ? seat.player.name : 'Empty'}
            </span>
            {seat.player && detail && (
              <span className="text-[10px] leading-tight text-text-secondary">{detail(seat.player)}</span>
            )}
            {seat.player && byes.has(seat.player.name) && (
              <span className="text-[10px] font-semibold uppercase leading-tight text-button-primary">bye</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

interface PairingListProps {
  seats: Seat[];
  pairings: Match[];
  label: string;
  emptyMessage: string;
}

// A round's pairings, one line per match, each player with their seat number.
export const PairingList: React.FC<PairingListProps> = ({ seats, pairings, label, emptyMessage }) => {
  const seatLabel = (name: string) => {
    const seat = seats.findIndex((candidate) => candidate.player?.name === name);
    return seat >= 0 ? `${name} (${seat + 1})` : name;
  };
  if (pairings.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        {emptyMessage}
      </Text>
    );
  }
  return (
    <ul aria-label={label} className="flex flex-col gap-1">
      {pairings.map((match, index) => {
        const byePlayer = match.p2 === BYE ? match.p1 : match.p1 === BYE ? match.p2 : null;
        return (
          // A list typed by hand can repeat a placeholder name, so position is the only stable key.
          // eslint-disable-next-line react/no-array-index-key
          <li key={index} className="text-sm">
            {byePlayer ? (
              <>
                {seatLabel(byePlayer)} <span className="text-text-secondary">has the bye</span>
              </>
            ) : (
              <>
                {seatLabel(match.p1)} <span className="text-text-secondary">vs</span> {seatLabel(match.p2)}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default SeatingTable;
