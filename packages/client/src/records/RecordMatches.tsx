import React, { useContext, useState } from 'react';

import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from '@primer/octicons-react';
import RecordType, { Match, Round } from '@utils/datatypes/Record';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import AddRoundModal from 'components/modals/AddRoundModal';
import RemoveRoundModal from 'components/modals/RemoveRoundModal';
import withModal from 'components/WithModal';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

import { MatchRowHeadings } from './EditMatchRound';
import RecordMatchRow from './RecordMatchRow';

const AddRoundLink = withModal(Button, AddRoundModal);
const RemoveRoundLink = withModal(Link, RemoveRoundModal);

interface RecordMatchesProps {
  record: RecordType;
}

const RecordMatches: React.FC<RecordMatchesProps> = ({ record }) => {
  const { canEdit } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);

  // Local echo of the server's rounds: each of the three match endpoints below returns the
  // round it touched, and that response — not a guess at what was just sent — is what gets
  // rendered, so a live console stays correct even if two devices report into the same round.
  const [matches, setMatches] = useState<Round[]>(record.matches);

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

  const applyRound = (roundIndex: number, round: Round) =>
    setMatches((previous) => previous.map((existing, position) => (position === roundIndex ? round : existing)));

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
  const postMatchEdit = async (
    action: 'set' | 'add' | 'remove',
    body: object,
  ): Promise<{ success: boolean; round?: Round }> => {
    try {
      const response = await csrfFetch(`/cube/records/edit/match/${action}/${record.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        return { success: false };
      }
      const json = await response.json();
      return { success: json?.success === 'true', round: json?.round };
    } catch {
      return { success: false };
    }
  };

  const commitMatch = async (roundIndex: number, matchIndex: number, match: Match) => {
    // Apply-then-post: the organiser's edit is reflected immediately (both on screen and as the
    // base the next edit builds on), and the network call that follows can fail without ever
    // taking that value back off the screen.
    applyMatchLocally(roundIndex, matchIndex, match);
    const key = matchKey(roundIndex, matchIndex);
    const { success, round } = await postMatchEdit('set', { roundIndex, matchIndex, match });
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
    const { round } = await postMatchEdit('add', { roundIndex });
    if (round) applyRound(roundIndex, round);
  };

  const removeMatch = async (roundIndex: number, matchIndex: number) => {
    const { round } = await postMatchEdit('remove', { roundIndex, matchIndex });
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
        {matches.length === 0 && <Text sm>{'No matches have been recorded for this record yet.'}</Text>}
        {canEdit && (
          <AddRoundLink color="primary" modalprops={{ record }}>
            {/* No status field backs this label — it is purely a function of matches.length,
                so a record that has never opened a round offers to start the event, and one
                that has offers to add to it. */}
            {matches.length === 0 ? 'Start the event' : 'Add Round'}
          </AddRoundLink>
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
                  </button>
                  {canEdit && (
                    <RemoveRoundLink className="text-danger" modalprops={{ record, roundIndex }}>
                      {'Remove Round'}
                    </RemoveRoundLink>
                  )}
                </Flexbox>
              </CardHeader>
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
      </Flexbox>
    </CardBody>
  );
};

export default RecordMatches;
