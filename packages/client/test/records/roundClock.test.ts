import { applyClockAction, clockRemainingMs, formatClock, RoundClock } from '@utils/records/roundClock';

const MINUTE = 60_000;

describe('round clock', () => {
  it('counts down from when it was started', () => {
    const clock = applyClockAction(undefined, 'start', 1_000, 50)!;
    expect(clock).toEqual({ durationMs: 50 * MINUTE, elapsedMs: 0, startedAt: 1_000 });
    expect(clockRemainingMs(clock, 1_000 + 10 * MINUTE)).toBe(40 * MINUTE);
  });

  it('holds its time while paused and picks up from there on resume', () => {
    const started = applyClockAction(undefined, 'start', 0, 50)!;
    const paused = applyClockAction(started, 'pause', 10 * MINUTE)!;
    expect(clockRemainingMs(paused, 30 * MINUTE)).toBe(40 * MINUTE);

    const resumed = applyClockAction(paused, 'resume', 30 * MINUTE)!;
    expect(clockRemainingMs(resumed, 35 * MINUTE)).toBe(35 * MINUTE);
  });

  it('adds time to a running or paused clock', () => {
    const started = applyClockAction(undefined, 'start', 0, 50)!;
    expect(clockRemainingMs(applyClockAction(started, 'add', 0, 5)!, 0)).toBe(55 * MINUTE);
  });

  it('ignores a press that does not fit the state, so two devices cannot double it up', () => {
    const started = applyClockAction(undefined, 'start', 0, 50)!;
    expect(applyClockAction(started, 'start', 5 * MINUTE, 30)).toBe(started);
    expect(applyClockAction(started, 'resume', 5 * MINUTE)).toBe(started);

    const paused = applyClockAction(started, 'pause', 5 * MINUTE)!;
    expect(applyClockAction(paused, 'pause', 9 * MINUTE)).toBe(paused);
    expect(applyClockAction(undefined, 'add', 0, 5)).toBeUndefined();
  });

  it('clears', () => {
    const paused: RoundClock = { durationMs: MINUTE, elapsedMs: 0 };
    expect(applyClockAction(paused, 'clear', 0)).toBeUndefined();
  });

  it('runs into overtime rather than stopping at zero', () => {
    const clock = applyClockAction(undefined, 'start', 0, 1)!;
    expect(clockRemainingMs(clock, 3 * MINUTE)).toBe(-2 * MINUTE);
  });

  it('formats the time left, rounding up so it never reads 0:00 early', () => {
    expect(formatClock(50 * MINUTE)).toBe('50:00');
    expect(formatClock(61_500)).toBe('1:02');
    expect(formatClock(400)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-125_000)).toBe('+2:05');
    expect(formatClock(90 * MINUTE)).toBe('1:30:00');
  });
});
