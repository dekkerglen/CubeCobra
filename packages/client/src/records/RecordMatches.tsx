import React, { useContext, useRef, useState } from 'react';

import {
  CheckCircleFillIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  ScreenFullIcon,
  TrophyIcon,
} from '@primer/octicons-react';
import RecordType, { isLiveEvent, Match, Round } from '@utils/datatypes/Record';
import { ClockAction } from '@utils/records/roundClock';
import { doubleBooked, isSelfPairing, roundProgress } from '@utils/records/roundChecks';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import PostButton from 'components/base/PostButton';
import AddRoundModal from 'components/modals/AddRoundModal';
import FinishTournamentModal from 'components/modals/FinishTournamentModal';
import RemoveRoundModal from 'components/modals/RemoveRoundModal';
import withModal from 'components/WithModal';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

import { MatchRowHeadings } from './EditMatchRound';
import PairingsDisplay from './PairingsDisplay';
import RecordMatchRow from './RecordMatchRow';
import { showsInBanner } from './RoundClockBanner';
import RoundClockControl from './RoundClockControl';

const AddRoundLink = withModal(Button, AddRoundModal);
const FinishTournamentLink = withModal(Button, FinishTournamentModal);

const RemoveRoundLink = withModal(Link, RemoveRoundModal);

interface RecordMatchesProps {
  // The record as this page has it live: its rounds and drops include changes made since load.
  record: RecordType;
  // Local echo of the server's rounds, held by the page so the standings follow it too: each of
  // the three match endpoints below returns the round it touched, and that response — not a
  // guess at what was just sent — is what gets rendered, so a live console stays correct even
  // if two devices report into the same round.
  setMatches: React.Dispatch<React.SetStateAction<Round[]>>;
  // The page's clock sync (useRoundClocks), shared with the clock banner above the tabs.
  serverOffset: number;
  onClockAction: (roundIndex: number, action: ClockAction, minutes?: number) => void;
}

// What's wrong with a round as it stands: anyone paired against themselves or booked twice.
// Flagged rather than refused, since a round being rearranged passes through both.
const RoundWarnings: React.FC<{ round: Round }> = ({ round }) => {
  const selfPaired = [...new Set(round.matches.filter(isSelfPairing).map((match) => match.p1))];
  const twice = doubleBooked(round);
  const warnings = [
    ...selfPaired.map((name) => `${name} is paired against themselves.`),
    ...(twice.length > 0
      ? [`${twice.join(', ')} ${twice.length === 1 ? 'is' : 'are'} in more than one match this round.`]
      : []),
  ];
  if (warnings.length === 0) {
    return null;
  }
  return (
    <div className="border-b border-border bg-danger/10 px-3 py-2">
      {warnings.map((warning) => (
        <Text key={warning} sm className="block text-danger">
          {warning}
        </Text>
      ))}
    </div>
  );
};

// "3 of 4 reported", turning into a check once every match between two players has a result.
const RoundProgress: React.FC<{ round: Round }> = ({ round }) => {
  const { reported, total } = roundProgress(round);
  if (total === 0) {
    return null;
  }
  if (reported === total) {
    return (
      <span className="flex items-center gap-1 text-sm text-text-secondary">
        <CheckCircleFillIcon size={14} className="text-button-primary" />
        All reported
      </span>
    );
  }
  return <Text sm className="text-text-secondary">{`${reported} of ${total} reported`}</Text>;
};

const RecordMatches: React.FC<RecordMatchesProps> = ({ record, setMatches, serverOffset, onClockAction }) => {
  const { canEdit } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);
  const matches = record.matches;

  // The latest round opens expanded; everything else starts collapsed to a summary. Tracked
  // as a set of expanded indices (not a single "current" index) so expanding an earlier round
  // to check or correct something doesn't collapse the one still being played.
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(
    () => new Set(matches.length > 0 ? [matches.length - 1] : []),
  );

  // Matches whose most recent commit did not land — a rejected request, a non-ok response, or
  // a body without `success: 'true'`. Keyed by "roundIndex:matchIndex" so the indication stays
  // attached to one row rather than the whole round, and survives across re-renders until a
  // later commit for that same match succeeds.
  const [failedMatches, setFailedMatches] = useState<Set<string>>(new Set());
  const matchKey = (roundIndex: number, matchIndex: number) => `${roundIndex}:${matchIndex}`;

  const toggleRound = (index: number) =>
    setExpandedRounds((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });

  // The rounds as the server last confirmed them. Each edit tells the server which match it
  // means by the players this holds for it, so an edit from a screen that missed another
  // device's change is refused instead of landing on whatever match now sits in that place.
  // Kept apart from what's on screen, which runs ahead of the server while edits are in flight.
  const confirmedRef = useRef<Round[]>(matches);
  // Edits go to the server one at a time, so each is checked against the state the one
  // before it left behind rather than racing it.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  // Said when the server refused an edit for being out of date and the page caught up.
  const [notice, setNotice] = useState<string | null>(null);
  const [showPairings, setShowPairings] = useState(false);
  const latestProgress = roundProgress(matches.at(-1));
  // Every result of the current round is in: the obvious next step is pairing the next one.
  const readyForNextRound =
    canEdit && isLiveEvent(record) && latestProgress.total > 0 && latestProgress.reported === latestProgress.total;
  const finished = Boolean(record.finishedAt);

  const applyRound = (roundIndex: number, round: Round) => {
    confirmedRef.current = confirmedRef.current.map((existing, position) =>
      position === roundIndex ? round : existing,
    );
    setMatches((previous) => previous.map((existing, position) => (position === roundIndex ? round : existing)));
  };

  const catchUp = (rounds: Round[], message: string) => {
    confirmedRef.current = rounds;
    setMatches(rounds);
    setFailedMatches(new Set());
    setNotice(message);
  };

  // Applies one match's next value to local state immediately, ahead of the network call that
  // persists it. This is what closes the race in Finding 2: a second edit to the same match,
  // fired before the first request's response lands, reads this already-applied value as its
  // `match` prop rather than the stale one the first edit started from, so its payload carries
  // both changes instead of reverting the first.
  const applyMatchLocally = (roundIndex: number, matchIndex: number, match: Match) =>
    setMatches((previous) =>
      previous.map((round, position) =>
        position === roundIndex
          ? { ...round, matches: round.matches.map((existing, index) => (index === matchIndex ? match : existing)) }
          : round,
      ),
    );

  // Never throws: a rejected csrfFetch, a non-ok response, or a thrown `.json()` all resolve to
  // `{ success: false }` here rather than propagating, so a caller that doesn't await this
  // still can't produce an unhandled rejection. `round` is independent of `success` — the real
  // endpoints only ever send one with the other, but a caller reconciles from whichever it got
  // rather than assuming a shape that happens to hold in production.
  const sendMatchEdit = async (
    action: 'set' | 'add' | 'remove',
    body: object,
  ): Promise<{ success: boolean; round?: Round; conflict?: boolean }> => {
    try {
      const response = await csrfFetch(`/cube/records/edit/match/${action}/${record.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.status === 409) {
        const json = await response.json();
        if (Array.isArray(json?.rounds)) {
          catchUp(json.rounds, json.message ?? 'This round was changed somewhere else. The latest version is shown.');
          return { success: false, conflict: true };
        }
      }
      if (!response.ok) {
        return { success: false };
      }
      const json = await response.json();
      return { success: json?.success === 'true', round: json?.round };
    } catch {
      return { success: false };
    }
  };

  // `body` is built when the edit's turn comes, from the rounds as confirmed by then.
  const postMatchEdit = (
    action: 'set' | 'add' | 'remove',
    body: () => object,
  ): Promise<{ success: boolean; round?: Round; conflict?: boolean }> => {
    const next = queueRef.current.then(() => sendMatchEdit(action, body()));
    queueRef.current = next.catch(() => undefined);
    return next;
  };

  // Who the server should find in a match before this edit applies to it.
  const expectedAt = (roundIndex: number, matchIndex: number) => {
    const match = confirmedRef.current[roundIndex]?.matches[matchIndex];
    return match ? { expected: { p1: match.p1, p2: match.p2 } } : {};
  };

  const commitMatch = async (roundIndex: number, matchIndex: number, match: Match) => {
    // Apply-then-post: the organiser's edit is reflected immediately (both on screen and as the
    // base the next edit builds on), and the network call that follows can fail without ever
    // taking that value back off the screen.
    applyMatchLocally(roundIndex, matchIndex, match);
    const key = matchKey(roundIndex, matchIndex);
    const { success, round, conflict } = await postMatchEdit('set', () => ({
      roundIndex,
      matchIndex,
      match,
      ...expectedAt(roundIndex, matchIndex),
    }));
    // Caught up to the server's rounds instead; this edit is gone with the screen it was made on.
    if (conflict) return;
    // The server's round is authoritative when present and may differ from what was sent
    // (e.g. a concurrent edit from elsewhere) — reconcile from it rather than trusting the
    // optimistic value forever.
    if (round) applyRound(roundIndex, round);
    setFailedMatches((previous) => {
      const hadFailure = previous.has(key);
      if (success) {
        if (!hadFailure) return previous;
        const next = new Set(previous);
        next.delete(key);
        return next;
      }
      // Do NOT roll back the optimistically-applied value above: only a per-row indication is
      // added, so the organiser can see which match to retry, without losing what they typed.
      if (hadFailure) return previous;
      return new Set(previous).add(key);
    });
  };

  const addMatch = async (roundIndex: number) => {
    // The server appends to the end of the round (see addMatchHandler), so no existing
    // match's index moves — failedMatches needs no reindexing here, unlike remove below.
    const { round } = await postMatchEdit('add', () => ({ roundIndex, expectedRounds: confirmedRef.current.length }));
    if (round) applyRound(roundIndex, round);
  };

  const removeMatch = async (roundIndex: number, matchIndex: number) => {
    const { round } = await postMatchEdit('remove', () => ({
      roundIndex,
      matchIndex,
      ...expectedAt(roundIndex, matchIndex),
    }));
    if (round) applyRound(roundIndex, round);
    // The removed match's own key is positional, not identity-based (Match has no stable
    // id), so it must be dropped, and every later match in the same round shifted down one
    // key to follow the row it actually belongs to — otherwise a stale "not saved" indicator
    // detaches from the match that failed and reattaches to whatever slides into its old
    // index. Only applied once the server confirms the round actually shifted.
    if (round) {
      setFailedMatches((previous) => {
        let changed = false;
        const next = new Set<string>();
        previous.forEach((key) => {
          const [keyRoundIndex, keyMatchIndex] = key.split(':').map(Number);
          if (keyRoundIndex !== roundIndex) {
            next.add(key);
            return;
          }
          if (keyMatchIndex === matchIndex) {
            changed = true;
            return;
          }
          if (keyMatchIndex > matchIndex) {
            next.add(matchKey(keyRoundIndex, keyMatchIndex - 1));
            changed = true;
            return;
          }
          next.add(key);
        });
        return changed ? next : previous;
      });
    }
  };

  return (
    <CardBody>
      <Flexbox direction="col" gap="2">
        {notice && (
          <div
            role="status"
            className="flex items-start justify-between gap-2 rounded-md border border-amber-500 bg-amber-500/10 p-2"
          >
            <Text sm>{notice}</Text>
            <button
              type="button"
              className="text-sm font-medium text-link hover:text-link-active"
              onClick={() => setNotice(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        {matches.length === 0 ? (
          /* The empty state the other tabs use: muted text with its one action directly
             beneath it. The button lived in the right-aligned control row below, which is
             right once that row has Show Pairings and Finish Tournament in it, but with
             nothing else there it put the sentence and the thing to do about it at opposite
             corners of an otherwise blank card. */
          <Flexbox direction="col" gap="2" alignItems="start">
            <Text sm className="text-text-secondary">
              No matches have been recorded for this record yet.
            </Text>
            {canEdit && !finished && (
              <AddRoundLink color="primary" modalprops={{ record }}>
                Record Matches
              </AddRoundLink>
            )}
          </Flexbox>
        ) : null}
        {finished && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-bg-accent px-4 py-3">
            <span className="flex items-center gap-2">
              <TrophyIcon size={16} className="text-amber-500" />
              <Text sm>
                <span className="font-semibold">Tournament finished</span>
                <span className="text-text-secondary">
                  {` on ${new Date(record.finishedAt!).toLocaleDateString()}${record.trophy.length > 0 ? ` · Won by ${record.trophy.join(', ')}` : ''}`}
                </span>
              </Text>
            </span>
            {canEdit && (
              <PostButton action={`/cube/records/edit/finish/reopen/${record.id}`} color="secondary" outline>
                Reopen
              </PostButton>
            )}
          </div>
        )}
        {(canEdit || matches.length > 0) && matches.length > 0 && (
          <Flexbox direction="row" gap="2" justify="end" wrap="wrap">
            <Button color="secondary" outline onClick={() => setShowPairings(true)}>
              <span className="flex items-center gap-2">
                <ScreenFullIcon size={16} />
                Show Pairings
              </span>
            </Button>
            {canEdit && !finished && !readyForNextRound && (
              <FinishTournamentLink color="secondary" outline modalprops={{ record }}>
                Finish Tournament
              </FinishTournamentLink>
            )}
            {canEdit && !finished && (
              // The rounds and drops as this page has them, not as it loaded them: results reported
              // here since then decide the next round's pairings. Quieter while the prompt below
              // the rounds offers the same thing as the obvious next step.
              <AddRoundLink color="primary" outline={readyForNextRound} modalprops={{ record }}>
                Add Round
              </AddRoundLink>
            )}
          </Flexbox>
        )}
        {showPairings && (
          <PairingsDisplay record={record} serverOffset={serverOffset} onClose={() => setShowPairings(false)} />
        )}
        {matches.map((round, roundIndex) => {
          const expanded = expandedRounds.has(roundIndex);
          return (
            <Card key={roundIndex}>
              <CardHeader>
                <Flexbox direction="row" justify="between" alignItems="center">
                  <button
                    type="button"
                    className="flex items-center gap-2"
                    onClick={() => toggleRound(roundIndex)}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} Round ${roundIndex + 1}`}
                  >
                    {expanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                    <Text md semibold>
                      {`Round ${roundIndex + 1}`}
                    </Text>
                    {!expanded && (
                      <Text sm className="text-text-secondary">
                        {`${round.matches.length} match${round.matches.length === 1 ? '' : 'es'}`}
                      </Text>
                    )}
                    <RoundProgress round={round} />
                  </button>
                  <Flexbox direction="row" gap="4" alignItems="center" wrap="wrap" justify="end">
                    {/* The banner above the tabs shows the current round's clock whenever it has
                        one; a round header keeps the rest, such as an earlier round's leftover
                        clock or the offer to start one on a past record. */}
                    {!(roundIndex === matches.length - 1 && showsInBanner(record, canEdit)) && (
                      <RoundClockControl
                        clock={round.clock}
                        canEdit={canEdit}
                        offerStart={roundIndex === matches.length - 1}
                        serverOffset={serverOffset}
                        onAction={(action, minutes) => onClockAction(roundIndex, action, minutes)}
                      />
                    )}
                    {canEdit && (
                      <RemoveRoundLink className="text-danger" modalprops={{ record, roundIndex }}>
                        {'Remove Round'}
                      </RemoveRoundLink>
                    )}
                  </Flexbox>
                </Flexbox>
              </CardHeader>
              {canEdit && <RoundWarnings round={round} />}
              {expanded && (
                <CardBody>
                  <Flexbox direction="col" gap="2">
                    {round.matches.length > 0 && <MatchRowHeadings />}
                    {round.matches.map((match, matchIndex) => (
                      <RecordMatchRow
                        key={matchIndex}
                        index={matchIndex}
                        match={match}
                        players={record.players}
                        canEdit={canEdit}
                        saveFailed={failedMatches.has(matchKey(roundIndex, matchIndex))}
                        onChange={(next) => commitMatch(roundIndex, matchIndex, next)}
                        onRemove={() => removeMatch(roundIndex, matchIndex)}
                      />
                    ))}
                    {canEdit && (
                      <Flexbox direction="row" justify="start">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-sm font-medium text-link hover:text-link-active"
                          onClick={() => addMatch(roundIndex)}
                        >
                          <PlusIcon size={16} />
                          Add Match
                        </button>
                      </Flexbox>
                    )}
                  </Flexbox>
                </CardBody>
              )}
            </Card>
          );
        })}
        {readyForNextRound && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-bg-accent px-4 py-3">
            <span className="flex items-center gap-2">
              <CheckCircleFillIcon size={16} className="text-button-primary" />
              <Text sm>
                <span className="font-semibold">{`Round ${matches.length} is complete.`}</span>
                <span className="text-text-secondary"> Every result is in.</span>
              </Text>
            </span>
            {/* Every result in is also when an event can end: both next steps, side by side. */}
            <span className="flex flex-wrap gap-2">
              <FinishTournamentLink color="secondary" outline modalprops={{ record }}>
                Finish Tournament
              </FinishTournamentLink>
              <AddRoundLink color="primary" modalprops={{ record }}>
                {`Pair Round ${matches.length + 1}`}
              </AddRoundLink>
            </span>
          </div>
        )}
      </Flexbox>
    </CardBody>
  );
};

export default RecordMatches;
