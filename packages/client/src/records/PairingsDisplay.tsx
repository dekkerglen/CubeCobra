import React, { useEffect, useMemo, useRef } from 'react';

import { XIcon } from '@primer/octicons-react';
import RecordType from '@utils/datatypes/Record';
import { BYE } from '@utils/records/pairings';
import { tableNumbers } from '@utils/records/roundChecks';
import { clockRemainingMs, formatClock, isClockRunning } from '@utils/records/roundClock';
import { computeStandings } from '@utils/records/standings';
import classNames from 'classnames';

import { useClockNow } from './RoundClockControl';

const WARNING_MS = 5 * 60_000;

interface PairingsDisplayProps {
  // The record as the page has it live, so a result reported elsewhere on the page shows here.
  record: RecordType;
  serverOffset: number;
  onClose: () => void;
}

const formatRecord = ({ wins, losses, draws }: { wins: number; losses: number; draws: number }) =>
  `${wins}-${losses}${draws > 0 ? `-${draws}` : ''}`;

/**
 * The current round for a screen across the room: every match by table number, each player's
 * record going into the round, the clock, and an alphabetical list for finding your own table.
 * Opens over the page and asks the browser for full screen; Escape or the close button leaves.
 */
const PairingsDisplay: React.FC<PairingsDisplayProps> = ({ record, serverOffset, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const roundIndex = record.matches.length - 1;
  const round = record.matches[roundIndex];
  const clock = round?.clock;
  const now = useClockNow(clock, serverOffset);

  // Read through a ref so a new onClose from each render of the page doesn't re-run the effect
  // below, which would leave and re-enter full screen every second the clock ticks.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // Not every browser allows it (iPhone Safari doesn't); the overlay fills the window anyway.
    ref.current?.requestFullscreen?.()?.catch(() => undefined);
    // While full screen, the browser takes Escape to leave it; the next one closes the overlay.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) {
        document.exitFullscreen?.()?.catch(() => undefined);
      }
    };
  }, []);

  // Records going into this round, not counting its own results as they come in.
  const records = useMemo(
    () =>
      new Map(
        computeStandings({ ...record, matches: record.matches.slice(0, -1) }).map((standing) => [
          standing.name,
          standing,
        ]),
      ),
    [record],
  );

  const tables = round ? tableNumbers(round) : [];
  const matches = (round?.matches ?? [])
    .map((match, index) => ({ match, table: tables[index] }))
    .filter((entry): entry is { match: (typeof entry)['match']; table: number } => entry.table !== null);
  const byes = (round?.matches ?? []).flatMap(({ p1, p2 }) => (p2 === BYE ? [p1] : p1 === BYE ? [p2] : []));
  // One line per player, even if a mistaken round lists someone twice.
  const directory = [
    ...new Map(
      [
        ...matches.flatMap(({ match, table }) => [
          { name: match.p1, where: `Table ${table}` },
          { name: match.p2, where: `Table ${table}` },
        ]),
        ...byes.map((name) => ({ name, where: 'Bye' })),
      ].map((entry) => [entry.name, entry]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const remaining = clock ? clockRemainingMs(clock, now) : null;
  const timeUp = remaining !== null && remaining <= 0;

  const player = (name: string) => (
    <span className="min-w-0">
      <span className="block truncate text-2xl font-semibold md:text-3xl">{name}</span>
      <span className="block text-base text-text-secondary">
        {formatRecord(records.get(name) ?? { wins: 0, losses: 0, draws: 0 })}
      </span>
    </span>
  );

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`Round ${roundIndex + 1} pairings`}
      className="fixed inset-0 z-50 flex flex-col overflow-auto bg-bg p-4 md:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="text-lg text-text-secondary">{record.name}</div>
          <div className="text-4xl font-bold md:text-5xl">{`Round ${roundIndex + 1}`}</div>
        </div>
        {remaining !== null && clock && (
          <div className="flex flex-col items-center">
            <span
              role="timer"
              aria-label="Pairings clock"
              className={classNames('font-mono text-6xl font-bold tabular-nums md:text-8xl', {
                'text-danger': timeUp,
                'text-amber-500': !timeUp && remaining <= WARNING_MS,
                'opacity-60': !isClockRunning(clock) && !timeUp,
              })}
            >
              {formatClock(remaining)}
            </span>
            {(timeUp || !isClockRunning(clock)) && (
              <span
                className={classNames(
                  'text-xl font-semibold uppercase',
                  timeUp ? 'text-danger' : 'text-text-secondary',
                )}
              >
                {timeUp ? "Time's up" : 'Paused'}
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          aria-label="Close Pairings"
          className="rounded p-2 text-text-secondary hover:bg-bg-active hover:text-text"
          onClick={onClose}
        >
          <XIcon size={24} />
        </button>
      </div>

      <div className="mt-6 flex grow flex-col gap-8 lg:flex-row">
        <div className="grid grow content-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {matches.map(({ match, table }) => {
            const [p1Wins, p2Wins, draws] = match.results;
            const reported = p1Wins + p2Wins + draws > 0;
            return (
              <div
                key={table}
                data-testid="pairing-card"
                className={classNames('flex items-center gap-4 rounded-lg border-2 p-4', {
                  'border-border': !reported,
                  'border-button-primary/40 opacity-70': reported,
                })}
              >
                <div className="flex w-16 shrink-0 flex-col items-center">
                  <span className="text-xs uppercase text-text-secondary">Table</span>
                  <span className="text-4xl font-bold tabular-nums">{table}</span>
                </div>
                <div className="grid min-w-0 grow grid-cols-[1fr_auto_1fr] items-center gap-3">
                  {player(match.p1)}
                  <span className="text-center text-lg text-text-secondary">
                    {reported ? (
                      <span className="font-mono text-2xl font-semibold text-text">
                        {`${p1Wins}-${p2Wins}${draws ? `-${draws}` : ''}`}
                      </span>
                    ) : (
                      'vs'
                    )}
                  </span>
                  <span className="text-right">{player(match.p2)}</span>
                </div>
              </div>
            );
          })}
          {byes.map((name) => (
            <div key={name} className="flex items-center gap-4 rounded-lg border-2 border-dashed border-border p-4">
              <div className="flex w-16 shrink-0 flex-col items-center">
                <span className="text-2xl font-bold uppercase text-button-primary">Bye</span>
              </div>
              {player(name)}
            </div>
          ))}
        </div>

        {directory.length > 0 && (
          <div className="lg:w-72 lg:shrink-0">
            <div className="mb-2 text-lg font-semibold">Find your table</div>
            <ul aria-label="Find your table" className="columns-2 gap-6 lg:columns-1">
              {directory.map(({ name, where }) => (
                <li key={name} className="flex justify-between gap-3 py-1 text-lg">
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{where}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default PairingsDisplay;
