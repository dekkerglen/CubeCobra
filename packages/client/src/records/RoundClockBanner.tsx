import React, { useContext, useEffect, useId, useRef, useState } from 'react';

import { ScreenFullIcon, ScreenNormalIcon } from '@primer/octicons-react';
import RecordType, { isLiveEvent } from '@utils/datatypes/Record';
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
import classNames from 'classnames';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import Text from 'components/base/Text';
import CubeContext from 'contexts/CubeContext';

import { useClockNow } from './RoundClockControl';

// The last stretch of a round, when the clock turns amber.
const WARNING_MS = 5 * 60_000;

// Whether the banner shows the latest round's clock: always once it has one, and for an editor
// while the event is on, so starting the clock is the first thing they see.
export const showsInBanner = (record: RecordType, canEdit: boolean): boolean => {
  const latest = record.matches.at(-1);
  return Boolean(!record.finishedAt && latest && (latest.clock || (canEdit && isLiveEvent(record))));
};

// Tracks whether `ref` is the element the browser is showing full screen.
const useFullscreen = (ref: React.RefObject<HTMLElement | null>) => {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(ref.current) && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, [ref]);
  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      ref.current?.requestFullscreen?.();
    }
  };
  // Not every browser offers it (iPhone Safari doesn't, for anything but video).
  const supported = typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);
  return { fullscreen, toggle, supported };
};

interface StartClockProps {
  roundNumber: number;
  onStart: (minutes: number) => void;
}

const StartClock: React.FC<StartClockProps> = ({ roundNumber, onStart }) => {
  const minutesId = useId();
  const [minutes, setMinutes] = useState(`${DEFAULT_ROUND_MINUTES}`);
  const parsed = parseInt(minutes, 10);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_ROUND_MINUTES;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Text lg semibold>{`Round ${roundNumber}`}</Text>
      <Text sm className="text-text-secondary">
        No clock running.
      </Text>
      <div className="ml-auto flex items-center gap-2">
        <label htmlFor={minutesId} className="sr-only">
          Round length in minutes
        </label>
        <Input
          id={minutesId}
          type="number"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          wrapperClassName="w-20"
          otherInputProps={{ min: 1, max: MAX_ROUND_MINUTES }}
        />
        <Text sm className="text-text-secondary">
          min
        </Text>
        <Button color="primary" disabled={!valid} onClick={() => onStart(parsed)}>
          Start Clock
        </Button>
      </div>
    </div>
  );
};

interface ClockFaceProps {
  clock: RoundClock;
  roundNumber: number;
  canEdit: boolean;
  serverOffset: number;
  onAction: (action: ClockAction, minutes?: number) => void;
}

const ClockFace: React.FC<ClockFaceProps> = ({ clock, roundNumber, canEdit, serverOffset, onAction }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { fullscreen, toggle, supported } = useFullscreen(ref);
  const now = useClockNow(clock, serverOffset);
  const running = isClockRunning(clock);
  const remaining = clockRemainingMs(clock, now);
  const timeUp = remaining <= 0;
  const warning = !timeUp && remaining <= WARNING_MS;
  const elapsedShare = clock.durationMs > 0 ? Math.min(1, Math.max(0, 1 - remaining / clock.durationMs)) : 1;

  const status = timeUp ? "Time's up" : running ? 'Running' : 'Paused';
  const tone = timeUp ? 'text-danger' : warning ? 'text-amber-500' : '';

  return (
    <div
      ref={ref}
      className={classNames('bg-bg', {
        'flex h-full w-full flex-col items-center justify-center gap-8 p-8': fullscreen,
      })}
    >
      <div
        className={classNames('flex items-center gap-x-6 gap-y-2 px-4 py-2', {
          'flex-col': fullscreen,
          'flex-col md:flex-row': !fullscreen,
        })}
      >
        <div className={classNames('flex items-center gap-3', { 'md:w-72': !fullscreen })}>
          <Text semibold className={fullscreen ? 'text-4xl' : 'text-lg'}>{`Round ${roundNumber}`}</Text>
          <span
            className={classNames('rounded-full px-2 py-0.5 text-xs font-semibold uppercase', {
              'bg-danger/15 text-danger': timeUp,
              'bg-button-primary/15 text-button-primary': running && !timeUp,
              'bg-bg-active text-text-secondary': !running && !timeUp,
            })}
          >
            {status}
          </span>
        </div>
        <span
          role="timer"
          aria-label="Round clock"
          className={classNames('grow text-center font-mono font-bold leading-none tabular-nums', tone, {
            'text-[22vw]': fullscreen,
            'text-5xl md:text-6xl': !fullscreen,
            'opacity-60': !running && !timeUp,
          })}
        >
          {formatClock(remaining)}
        </span>
        <div
          className={classNames('flex flex-wrap items-center justify-center gap-2', {
            'md:w-72 md:flex-nowrap md:justify-end': !fullscreen,
          })}
        >
          {canEdit && (
            <>
              {running ? (
                <Button color="primary" outline onClick={() => onAction('pause')}>
                  Pause
                </Button>
              ) : (
                <Button color="primary" onClick={() => onAction('resume')}>
                  Resume
                </Button>
              )}
              <Button color="secondary" outline onClick={() => onAction('add', ADD_TIME_MINUTES)}>
                {`+${ADD_TIME_MINUTES} min`}
              </Button>
              {!running && (
                <Button color="danger" outline onClick={() => onAction('clear')}>
                  Clear
                </Button>
              )}
            </>
          )}
          {supported && (
            <button
              type="button"
              aria-label={fullscreen ? 'Exit full screen' : 'Show the clock full screen'}
              title={fullscreen ? 'Exit full screen' : 'Full screen, for a projector or TV'}
              className="rounded p-1 text-text-secondary hover:bg-bg-active hover:text-text"
              onClick={toggle}
            >
              {fullscreen ? <ScreenNormalIcon size={20} /> : <ScreenFullIcon size={20} />}
            </button>
          )}
        </div>
      </div>
      <div
        className={classNames('h-1 bg-border/60', { 'w-2/3 rounded-full': fullscreen, 'w-full': !fullscreen })}
        aria-hidden="true"
      >
        <div
          className={classNames('h-full transition-[width] duration-1000 ease-linear', {
            'bg-danger': timeUp,
            'bg-amber-500': warning,
            'bg-button-primary': !timeUp && !warning,
            'rounded-full': fullscreen,
          })}
          style={{ width: `${elapsedShare * 100}%` }}
        />
      </div>
    </div>
  );
};

interface RoundClockBannerProps {
  // The record as the page has it live, so a clock started anywhere shows here at once.
  record: RecordType;
  serverOffset: number;
  onClockAction: (roundIndex: number, action: ClockAction, minutes?: number) => void;
}

/**
 * The current round's clock, big, pinned to the top of the record page over every tab, so a
 * room can read it from across the table and the organiser can run it from anywhere on the page.
 */
const RoundClockBanner: React.FC<RoundClockBannerProps> = ({ record, serverOffset, onClockAction }) => {
  const { canEdit } = useContext(CubeContext);
  if (!showsInBanner(record, canEdit)) {
    return null;
  }
  const roundIndex = record.matches.length - 1;
  const { clock } = record.matches[roundIndex]!;
  const roundNumber = roundIndex + 1;

  return (
    <div
      className="sticky top-0 z-30 my-2 overflow-hidden rounded-md border border-border bg-bg shadow-md"
      data-testid="round-clock-banner"
    >
      {clock ? (
        <ClockFace
          clock={clock}
          roundNumber={roundNumber}
          canEdit={canEdit}
          serverOffset={serverOffset}
          onAction={(action, minutes) => onClockAction(roundIndex, action, minutes)}
        />
      ) : (
        <StartClock roundNumber={roundNumber} onStart={(minutes) => onClockAction(roundIndex, 'start', minutes)} />
      )}
    </div>
  );
};

export default RoundClockBanner;
