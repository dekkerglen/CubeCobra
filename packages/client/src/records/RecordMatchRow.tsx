import React, { useId } from 'react';

import { AlertIcon, XIcon } from '@primer/octicons-react';
import classNames from 'classnames';
import { Match, PlayerList } from '@utils/datatypes/Record';
import { BYE, UNKNOWN_OPPONENT } from '@utils/records/pairings';

import Input from 'components/base/Input';
import MobileFieldLabel from 'components/base/MobileFieldLabel';
import { Col, Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';

import {
  MATCH_PLAYER_COL,
  MATCH_RESULT_COL,
  MATCH_RESULT_HEADINGS,
  MatchFieldGrid,
  MatchRowFrame,
  withoutOpponent,
} from './EditMatchRound';

interface RecordMatchRowProps {
  index: number;
  match: Match;
  players: PlayerList;
  canEdit: boolean;
  // True when this match's most recent commit did not land (rejected request, non-ok
  // response, or a body without success: 'true'). The row still shows whatever the organiser
  // last typed — RecordMatches never rolls that back — this is only the retry hint.
  saveFailed: boolean;
  // Commits the whole next match in one call — there is no local round array to diff, so
  // every field (a pairing or a result) hands back the complete match it belongs to.
  onChange: (match: Match) => void;
  onRemove: () => void;
}

// The results almost every best-of-three ends in, as one tap each, read as player 1's games
// first: "2-1" is player 1 winning two games to one. The number fields stay for anything else.
const QUICK_RESULTS: [number, number, number][] = [
  [2, 0, 0],
  [2, 1, 0],
  [1, 2, 0],
  [0, 2, 0],
  [1, 1, 1],
];

const QuickResults: React.FC<{ match: Match; onChange: (match: Match) => void }> = ({ match, onChange }) => (
  <div
    role="group"
    aria-label={`Quick result for ${match.p1} against ${match.p2}`}
    className="mt-1 flex flex-wrap items-center gap-1"
  >
    {QUICK_RESULTS.map((results) => {
      const [p1Wins, p2Wins, draws] = results;
      const chosen = match.results.every((count, position) => count === results[position]);
      const label = `${p1Wins}-${p2Wins}${draws ? `-${draws}` : ''}`;
      return (
        <button
          key={label}
          type="button"
          aria-pressed={chosen}
          aria-label={`${match.p1} ${label} ${match.p2}`}
          onClick={() => onChange({ ...match, results: [...results] as [number, number, number] })}
          title={`${match.p1} ${label} ${match.p2}`}
          className={classNames(
            'rounded border px-3 py-1 text-sm font-medium tabular-nums transition-colors md:px-2 md:py-0.5 md:text-xs',
            {
              'border-button-primary bg-button-primary text-white': chosen,
              'border-border bg-bg text-text-secondary hover:border-button-primary hover:text-text': !chosen,
            },
          )}
        >
          {label}
        </button>
      );
    })}
  </div>
);

// A standalone row rather than a parameterised EditMatchRound: that component is controlled
// by a whole Round and a single setRound, which fits bulk entry (the transcription workspace)
// but not a console where every field is its own network call against a single match. It
// shares EditMatchRound's layout primitives (NUMBER_COLUMN, the same control order) so the
// two look identical, without bending the shared component's contract to fit this one.
// NOTE: this row's JSX is otherwise a deliberate duplicate of EditMatchRound's per-row markup
// (see that file for why). Changing this row's layout likely means changing that one too.
const RecordMatchRow: React.FC<RecordMatchRowProps> = ({
  index,
  match,
  players,
  canEdit,
  saveFailed,
  onChange,
  onRemove,
}) => {
  const idPrefix = useId();

  // A match can reference a player no longer in record.players (removed elsewhere, or a
  // round opened before they were added). That name stays selectable rather than silently
  // dropping off the list the moment the round that recorded it loses sync with the roster.
  const knownNames = new Set([UNKNOWN_OPPONENT, BYE, ...players.map((player) => player.name)]);
  const stalePlayerNames = [match.p1, match.p2].filter((name) => !knownNames.has(name));
  const playerOptions = [
    { label: UNKNOWN_OPPONENT, value: UNKNOWN_OPPONENT },
    { label: BYE, value: BYE },
    ...players.map((player) => ({ label: player.name, value: player.name })),
    ...Array.from(new Set(stalePlayerNames)).map((name) => ({ label: name, value: name })),
  ];

  const resultCells: { position: 0 | 1 | 2; name: string }[] = [
    { position: 0, name: `${match.p1} Wins` },
    { position: 1, name: `${match.p2} Wins` },
    { position: 2, name: 'Draws' },
  ];

  if (!canEdit) {
    // The public view of a finished event: every control gone, but the pairing and the
    // score still read the same way, cell for cell, as the editable row above it.
    return (
      <MatchRowFrame
        lead={<Text sm className="w-6 shrink-0 text-text-secondary">{`${index + 1}`}</Text>}
        trail={<span aria-hidden="true" className="w-6 shrink-0" />}
      >
        <MatchFieldGrid>
          <Col {...MATCH_PLAYER_COL}>
            <MobileFieldLabel>Player 1</MobileFieldLabel>
            <Text sm>{match.p1}</Text>
          </Col>
          <Col {...MATCH_PLAYER_COL}>
            <MobileFieldLabel>Player 2</MobileFieldLabel>
            <Text sm>{match.p2}</Text>
          </Col>
          {/* Text has no title prop, so the hint (and the name getByTitle looks up in tests)
              lives on a plain wrapping span instead. */}
          {resultCells.map(({ position, name }) => (
            <Col key={position} {...MATCH_RESULT_COL}>
              <MobileFieldLabel>{MATCH_RESULT_HEADINGS[position]}</MobileFieldLabel>
              <span title={name}>
                <Text sm>{match.results[position]}</Text>
              </span>
            </Col>
          ))}
        </MatchFieldGrid>
      </MatchRowFrame>
    );
  }

  return (
    <Flexbox direction="col" gap="1">
      <MatchRowFrame
        lead={<Text sm className="w-6 shrink-0 text-text-secondary md:pt-2">{`${index + 1}`}</Text>}
        trail={
          /* Removing one match of a round is routine bookkeeping (a late drop, a bye) not the
             destructive act a filled danger button announces. */
          <button
            type="button"
            aria-label={`Remove match ${index + 1}`}
            className="w-6 shrink-0 text-text-secondary hover:text-red-600 md:pt-2"
            onClick={onRemove}
          >
            <XIcon size={16} />
          </button>
        }
      >
        <MatchFieldGrid>
          <Col {...MATCH_PLAYER_COL}>
            <MobileFieldLabel>Player 1</MobileFieldLabel>
            <Select
              id={`${idPrefix}-match-${index}-p1`}
              aria-label="Player 1"
              value={match.p1}
              setValue={(value) => onChange({ ...match, p1: value })}
              options={withoutOpponent(playerOptions, match.p2, match.p1)}
            />
          </Col>
          <Col {...MATCH_PLAYER_COL}>
            <MobileFieldLabel>Player 2</MobileFieldLabel>
            <Select
              id={`${idPrefix}-match-${index}-p2`}
              aria-label="Player 2"
              value={match.p2}
              setValue={(value) => onChange({ ...match, p2: value })}
              options={withoutOpponent(playerOptions, match.p1, match.p2)}
            />
          </Col>
          {resultCells.map(({ position, name }) => (
            <Col key={position} {...MATCH_RESULT_COL}>
              <MobileFieldLabel>{MATCH_RESULT_HEADINGS[position]}</MobileFieldLabel>
              <Input
                id={`${idPrefix}-match-${index}-${position}`}
                type="number"
                value={`${match.results[position]}`}
                onChange={(e) => {
                  const results = [...match.results] as [number, number, number];
                  results[position] = Number(e.target.value);
                  onChange({ ...match, results });
                }}
                otherInputProps={{ min: 0, max: 100, title: name, 'aria-label': name }}
              />
            </Col>
          ))}
        </MatchFieldGrid>
        {match.p1 !== BYE &&
          match.p2 !== BYE &&
          match.p1 !== UNKNOWN_OPPONENT &&
          match.p2 !== UNKNOWN_OPPONENT &&
          match.p1 !== match.p2 && <QuickResults match={match} onChange={onChange} />}
      </MatchRowFrame>
      {/* The organiser's typed value stays on screen either way — this is only the retry hint,
          never a rollback. Cleared the moment a later commit for this same match succeeds. */}
      {saveFailed && (
        <Flexbox direction="row" gap="1" alignItems="center" className="pl-8">
          <AlertIcon size={14} className="text-danger" />
          <span role="alert">
            <Text sm className="text-danger">
              {'Not saved — try again'}
            </Text>
          </span>
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default RecordMatchRow;
