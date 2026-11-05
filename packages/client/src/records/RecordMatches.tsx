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

  const postMatchEdit = async (action: 'set' | 'add' | 'remove', body: object, roundIndex: number) => {
    const response = await csrfFetch(`/cube/records/edit/match/${action}/${record.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (json.success === 'true' && json.round) {
      applyRound(roundIndex, json.round);
    }
  };

  const commitMatch = (roundIndex: number, matchIndex: number, match: Match) =>
    postMatchEdit('set', { roundIndex, matchIndex, match }, roundIndex);

  const addMatch = (roundIndex: number) => postMatchEdit('add', { roundIndex }, roundIndex);

  const removeMatch = (roundIndex: number, matchIndex: number) =>
    postMatchEdit('remove', { roundIndex, matchIndex }, roundIndex);

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
