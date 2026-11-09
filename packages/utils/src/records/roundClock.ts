import { Round } from '@utils/datatypes/Record';

// A round's clock, stored on the round so every device showing the record counts down from
// the same moment and a reload doesn't reset it. Times are server milliseconds.
export interface RoundClock {
  // The round's full length, including any time added since it started.
  durationMs: number;
  // Time already run before the current stretch. Grows each time the clock is paused.
  elapsedMs: number;
  // When the current stretch began. Absent while paused.
  startedAt?: number;
}

export type ClockAction = 'start' | 'pause' | 'resume' | 'add' | 'clear';

export const DEFAULT_ROUND_MINUTES = 50;
export const MAX_ROUND_MINUTES = 600;
export const ADD_TIME_MINUTES = 5;

const MINUTE_MS = 60_000;

export const isClockRunning = (clock: RoundClock): boolean => clock.startedAt !== undefined;

// Negative once time is up: the clock keeps counting into overtime rather than stopping.
export const clockRemainingMs = (clock: RoundClock, now: number): number =>
  clock.durationMs - clock.elapsedMs - (clock.startedAt !== undefined ? Math.max(0, now - clock.startedAt) : 0);

/**
 * The clock after `action`, or undefined for a round with no clock. Actions that don't apply
 * to the clock's current state (pausing a paused clock, adding time to no clock) return it
 * unchanged, so two devices pressing the same button at once can't double-apply it.
 */
export const applyClockAction = (
  clock: RoundClock | undefined,
  action: ClockAction,
  now: number,
  minutes: number = DEFAULT_ROUND_MINUTES,
): RoundClock | undefined => {
  switch (action) {
    case 'start':
      return clock ?? { durationMs: minutes * MINUTE_MS, elapsedMs: 0, startedAt: now };
    case 'pause':
      if (!clock || clock.startedAt === undefined) return clock;
      return { durationMs: clock.durationMs, elapsedMs: clock.elapsedMs + Math.max(0, now - clock.startedAt) };
    case 'resume':
      if (!clock || clock.startedAt !== undefined) return clock;
      return { ...clock, startedAt: now };
    case 'add':
      if (!clock) return clock;
      return { ...clock, durationMs: clock.durationMs + minutes * MINUTE_MS };
    case 'clear':
      return undefined;
    default:
      return clock;
  }
};

// m:ss, or h:mm:ss for a round over an hour. Overtime is shown as a positive count prefixed "+".
export const formatClock = (remainingMs: number): string => {
  const overtime = remainingMs < 0;
  // Count down in whole seconds without showing 0:00 while time is still left.
  const totalSeconds = overtime ? Math.floor(-remainingMs / 1000) : Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const body = hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
  return overtime ? `+${body}` : body;
};

// Each stored round's clock, in round order, for the endpoint that lets other devices catch up.
export const roundClocks = (rounds: Round[]): (RoundClock | null)[] => rounds.map((round) => round.clock ?? null);
