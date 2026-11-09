import React, { useEffect, useId, useState } from 'react';

import {
  ADD_TIME_MINUTES,
  ClockAction,
  clockRemainingMs,
  DEFAULT_ROUND_MINUTES,
  formatClock,
  isClockRunning,
  MAX_ROUND_MINUTES,
  RoundClock,
} from '@utils/records/roundClock';

import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

interface RoundClockControlProps {
  clock?: RoundClock;
  canEdit: boolean;
  // Only the round being played offers to start a clock; an earlier round shows one it had.
  offerStart: boolean;
  // Server time minus this device's time, so the countdown matches every other screen.
  serverOffset: number;
  onAction: (action: ClockAction, minutes?: number) => void;
}

// The server's time now, ticking once a second while `clock` runs.
export const useClockNow = (clock: RoundClock | undefined, serverOffset: number): number => {
  const [now, setNow] = useState(() => Date.now() + serverOffset);
  const running = clock ? isClockRunning(clock) : false;

  useEffect(() => {
    setNow(Date.now() + serverOffset);
    if (!running) {
      return undefined;
    }
    const interval = setInterval(() => setNow(Date.now() + serverOffset), 1000);
    return () => clearInterval(interval);
  }, [running, serverOffset, clock]);

  return now;
};

const controlClass = 'text-sm font-medium text-link hover:text-link-active text-nowrap';

const RoundClockControl: React.FC<RoundClockControlProps> = ({
  clock,
  canEdit,
  offerStart,
  serverOffset,
  onAction,
}) => {
  const minutesId = useId();
  const [minutes, setMinutes] = useState(`${DEFAULT_ROUND_MINUTES}`);
  const now = useClockNow(clock, serverOffset);
  const running = clock ? isClockRunning(clock) : false;

  if (!clock) {
    if (!canEdit || !offerStart) {
      return null;
    }
    const parsed = parseInt(minutes, 10);
    const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_ROUND_MINUTES;
    return (
      <Flexbox direction="row" gap="2" alignItems="center">
        <label htmlFor={minutesId} className="sr-only">
          Round length in minutes
        </label>
        <Input
          id={minutesId}
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          wrapperClassName="w-20"
          otherInputProps={{ min: 1, max: MAX_ROUND_MINUTES }}
        />
        <Text sm className="text-text-secondary">
          min
        </Text>
        <button type="button" className={controlClass} disabled={!valid} onClick={() => onAction('start', parsed)}>
          Start Clock
        </button>
      </Flexbox>
    );
  }

  const remaining = clockRemainingMs(clock, now);
  const timeUp = remaining <= 0;

  return (
    <Flexbox direction="row" gap="3" alignItems="center" wrap="wrap">
      <span
        role="timer"
        aria-label="Round clock"
        className={`font-mono text-lg font-semibold tabular-nums ${timeUp ? 'text-danger' : ''}`}
      >
        {timeUp ? `Time ${formatClock(remaining)}` : formatClock(remaining)}
      </span>
      {!running && (
        <Text sm className="text-text-secondary">
          Paused
        </Text>
      )}
      {canEdit && (
        <>
          {running ? (
            <button type="button" className={controlClass} onClick={() => onAction('pause')}>
              Pause
            </button>
          ) : (
            <button type="button" className={controlClass} onClick={() => onAction('resume')}>
              Resume
            </button>
          )}
          <button type="button" className={controlClass} onClick={() => onAction('add', ADD_TIME_MINUTES)}>
            {`+${ADD_TIME_MINUTES} min`}
          </button>
          {!running && (
            <button type="button" className={controlClass} onClick={() => onAction('clear')}>
              Clear
            </button>
          )}
        </>
      )}
    </Flexbox>
  );
};

export default RoundClockControl;
