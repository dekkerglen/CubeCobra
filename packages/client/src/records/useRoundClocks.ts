import React, { useContext, useEffect, useRef, useState } from 'react';

import RecordType, { isLiveEvent, Round } from '@utils/datatypes/Record';
import { ClockAction, RoundClock } from '@utils/records/roundClock';

import { CSRFContext } from 'contexts/CSRFContext';

// How often a device checks for a clock started, paused or extended somewhere else.
const CLOCK_POLL_MS = 30_000;

const withClock = (round: Round, clock: RoundClock | null | undefined): Round => {
  if (clock) {
    return { ...round, clock };
  }
  const { clock: _removed, ...rest } = round;
  return rest;
};

/**
 * Keeps the record's round clocks in step with the server, and runs clock actions against it.
 * Held by the page rather than the Matches tab so the clock banner above the tabs and the
 * rounds listed in them read and change the same clocks.
 */
const useRoundClocks = (record: RecordType, setRounds: React.Dispatch<React.SetStateAction<Round[]>>) => {
  const { csrfFetch } = useContext(CSRFContext);
  // Server time minus this device's, learned from every clock response, so a countdown here
  // agrees with the one on the organiser's phone even when this device's clock is off.
  const [serverOffset, setServerOffset] = useState(0);
  // How many rounds this page shows, sent with each action so it lands on the round meant.
  const roundCount = useRef(record.matches.length);
  useEffect(() => {
    roundCount.current = record.matches.length;
  }, [record.matches.length]);

  useEffect(() => {
    // Only an event still being played needs its clocks kept in sync.
    if (!isLiveEvent(record)) {
      return undefined;
    }
    let cancelled = false;
    const poll = async () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      try {
        const response = await fetch(`/cube/records/clock/${record.id}`);
        if (!response.ok) {
          return;
        }
        const json = await response.json();
        if (!cancelled && json?.success === 'true') {
          setServerOffset(json.now - Date.now());
          const clocks: (RoundClock | null)[] = json.clocks;
          setRounds((previous) =>
            previous.map((round, index) => (index < clocks.length ? withClock(round, clocks[index]) : round)),
          );
        }
      } catch {
        // A missed poll just means the next one catches up.
      }
    };
    poll();
    const interval = setInterval(poll, CLOCK_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, record.date]);

  const clockAction = async (roundIndex: number, action: ClockAction, minutes?: number) => {
    try {
      const response = await csrfFetch(`/cube/records/clock/${record.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundIndex,
          action,
          expectedRounds: roundCount.current,
          ...(minutes !== undefined ? { minutes } : {}),
        }),
      });
      if (response.status === 409) {
        // Rounds were added or removed elsewhere: show them, so the banner is on the right round.
        const json = await response.json();
        if (Array.isArray(json?.rounds)) {
          setRounds(json.rounds);
        }
        return;
      }
      if (!response.ok) {
        return;
      }
      const json = await response.json();
      if (json?.success === 'true') {
        setServerOffset(json.now - Date.now());
        setRounds((previous) =>
          previous.map((round, index) => (index === roundIndex ? withClock(round, json.clock) : round)),
        );
      }
    } catch {
      // Nothing changed on the server, so nothing changes here; the button can be pressed again.
    }
  };

  return { serverOffset, clockAction };
};

export default useRoundClocks;
