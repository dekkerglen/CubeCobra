import React, { useId } from 'react';

import { AlertIcon, XIcon } from '@primer/octicons-react';
import { Match, PlayerList } from '@utils/datatypes/Record';

import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';

import { NUMBER_COLUMN } from './EditMatchRound';

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
  const knownNames = new Set(['Unknown Opponent', ...players.map((player) => player.name)]);
  const stalePlayerNames = [match.p1, match.p2].filter((name) => !knownNames.has(name));
  const playerOptions = [
    { label: 'Unknown Opponent', value: 'Unknown Opponent' },
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
      <Flexbox direction="row" gap="2" alignItems="center">
        <Text sm className="w-6 shrink-0 text-text-secondary">{`${index + 1}`}</Text>
        <Text sm className="grow min-w-0">
          {match.p1}
        </Text>
        <Text sm className="grow min-w-0">
          {match.p2}
        </Text>
        {/* Text has no title prop, so the hint (and the name getByTitle looks up in tests)
            lives on a plain wrapping span instead. */}
        {resultCells.map(({ position, name }) => (
          <span key={position} title={name} className={NUMBER_COLUMN}>
            <Text sm>{match.results[position]}</Text>
          </span>
        ))}
        <span aria-hidden="true" className="w-6 shrink-0" />
      </Flexbox>
    );
  }

  return (
    <Flexbox direction="col" gap="1">
      <Flexbox direction="row" gap="2" alignItems="center">
        <Text sm className="w-6 shrink-0 text-text-secondary">{`${index + 1}`}</Text>
        <div className="grow min-w-0">
          <Select
            id={`${idPrefix}-match-${index}-p1`}
            aria-label="Player 1"
            value={match.p1}
            setValue={(value) => onChange({ ...match, p1: value })}
            options={playerOptions}
          />
        </div>
        <div className="grow min-w-0">
          <Select
            id={`${idPrefix}-match-${index}-p2`}
            aria-label="Player 2"
            value={match.p2}
            setValue={(value) => onChange({ ...match, p2: value })}
            options={playerOptions}
          />
        </div>
        {resultCells.map(({ position, name }) => (
          <Input
            key={position}
            id={`${idPrefix}-match-${index}-${position}`}
            type="number"
            value={`${match.results[position]}`}
            onChange={(e) => {
              const results = [...match.results] as [number, number, number];
              results[position] = Number(e.target.value);
              onChange({ ...match, results });
            }}
            otherInputProps={{ min: 0, max: 100, title: name, 'aria-label': name }}
            wrapperClassName={NUMBER_COLUMN}
          />
        ))}
        {/* Removing one match of a round is routine bookkeeping (a late drop, a bye) not the
            destructive act a filled danger button announces. */}
        <button
          type="button"
          aria-label={`Remove match ${index + 1}`}
          className="w-6 shrink-0 text-text-secondary hover:text-red-600"
          onClick={onRemove}
        >
          <XIcon size={16} />
        </button>
      </Flexbox>
      {/* The organiser's typed value stays on screen either way — this is only the retry hint,
          never a rollback. Cleared the moment a later commit for this same match succeeds. */}
      {saveFailed && (
        <Flexbox direction="row" gap="1" alignItems="center" className="pl-8">
          <AlertIcon size={14} className="text-red-600" />
          <span role="alert">
            <Text sm className="text-red-600">
              {'Not saved — try again'}
            </Text>
          </span>
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default RecordMatchRow;
