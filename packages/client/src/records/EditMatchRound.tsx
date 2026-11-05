import React, { useId } from 'react';

import { PlusIcon, XIcon } from '@primer/octicons-react';
import { Match, PlayerList, Round } from '@utils/datatypes/Record';

import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';

// The shape a match starts in, shared with whatever creates a round so a new one arrives
// with a row in it rather than an empty body and a second click to make.
export const emptyMatch = (): Match => ({
  p1: 'Unknown Opponent',
  p2: 'Unknown Opponent',
  results: [0, 0, 0],
});

// The columns a match row is cut into, shared with anything that lays out a row the same
// way (the matches console's per-match row) so the headings above a list and the cells
// below it are always the same widths, in whichever component renders them.
export const NUMBER_COLUMN = 'w-20 shrink-0';

// Said once, above a list of match rows. Each cell's own name — "Alice Wins" — stays as its
// accessible name and its title, because a column heading cannot say whose. Exported so the
// matches console's row (a separate component, not this one) heads its list identically.
export const MatchRowHeadings: React.FC = () => (
  <div data-testid="match-column-headings">
    <Flexbox direction="row" gap="2" alignItems="center">
      <span aria-hidden="true" className="w-6 shrink-0" />
      <Text sm semibold className="grow min-w-0 text-text-secondary">
        Player 1
      </Text>
      <Text sm semibold className="grow min-w-0 text-text-secondary">
        Player 2
      </Text>
      {/* Abbreviated because the column is the width of the count it heads; it reads
          against the "Player 1" and "Player 2" headings immediately to its left, and
          each cell still carries the player's own name as its title. */}
      {['P1 Wins', 'P2 Wins', 'Draws'].map((heading, position) => (
        <Text key={position} sm semibold className={`${NUMBER_COLUMN} text-text-secondary`}>
          {heading}
        </Text>
      ))}
      <span aria-hidden="true" className="w-6 shrink-0" />
    </Flexbox>
  </div>
);

interface EditMatchRoundProps {
  players: PlayerList;
  round: Round;
  setRound: (round: Round) => void;
}

const EditMatchRound: React.FC<EditMatchRoundProps> = ({ round, players, setRound }) => {
  // Namespaces the control ids so the labels stay bound to their own inputs when more than one
  // round is on the page at once, rather than all pointing at the first round's `match-0-p1`.
  const idPrefix = useId();

  const playerOptions = [
    { label: 'Unknown Opponent', value: 'Unknown Opponent' },
    ...(players?.map((player) => ({
      label: player.name,
      value: player.name,
    })) || []),
  ];

  const updateMatch = (index: number, changes: Partial<Match>) => {
    const newMatches = [...round.matches];
    newMatches[index] = { ...newMatches[index], ...changes };
    setRound({ ...round, matches: newMatches });
  };

  const updateResult = (index: number, position: 0 | 1 | 2, value: string) => {
    const results: [number, number, number] = [...round.matches[index].results];
    results[position] = Number(value);
    updateMatch(index, { results });
  };

  return (
    <Flexbox direction="col" gap="2">
      {round.matches.length > 0 && <MatchRowHeadings />}
      {round.matches.map((match, index) => (
        <Flexbox key={index} direction="row" gap="2" alignItems="center">
          <Text sm className="w-6 shrink-0 text-text-secondary">{`${index + 1}`}</Text>
          <div className="grow min-w-0">
            <Select
              id={`${idPrefix}-match-${index}-p1`}
              aria-label="Player 1"
              value={match.p1}
              setValue={(value) => updateMatch(index, { p1: value })}
              options={playerOptions}
            />
          </div>
          <div className="grow min-w-0">
            <Select
              id={`${idPrefix}-match-${index}-p2`}
              aria-label="Player 2"
              value={match.p2}
              setValue={(value) => updateMatch(index, { p2: value })}
              options={playerOptions}
            />
          </div>
          {/* `shrink-0` as well as the width: these sit beside two growing selects, which
              squeeze a plain w-20 cell to a third of it. wrapperClassName replaces the
              default `block w-full` rather than adding to it. */}
          {[
            { position: 0 as const, name: `${match.p1} Wins` },
            { position: 1 as const, name: `${match.p2} Wins` },
            { position: 2 as const, name: 'Draws' },
          ].map(({ position, name }) => (
            <Input
              key={position}
              id={`${idPrefix}-match-${index}-${position}`}
              type="number"
              value={`${match.results[position]}`}
              onChange={(e) => updateResult(index, position, e.target.value)}
              otherInputProps={{ min: 0, max: 100, title: name, 'aria-label': name }}
              wrapperClassName={NUMBER_COLUMN}
            />
          ))}
          {/* Removing one match of a round is routine bookkeeping, not the destructive act a
              filled danger button announces. */}
          <button
            type="button"
            aria-label={`Remove match ${index + 1}`}
            className="w-6 shrink-0 text-text-secondary hover:text-red-600"
            onClick={() => {
              const newMatches = [...round.matches];
              newMatches.splice(index, 1);
              setRound({ ...round, matches: newMatches });
            }}
          >
            <XIcon size={16} />
          </button>
        </Flexbox>
      ))}
      {/* Adding a row to a round is routine, and a filled primary button gave it the same
          weight as Save at the bottom of the page. */}
      <Flexbox direction="row" justify="start">
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-medium text-link hover:text-link-active"
          onClick={() => setRound({ ...round, matches: [...round.matches, emptyMatch()] })}
        >
          <PlusIcon size={16} />
          Add Match
        </button>
      </Flexbox>
    </Flexbox>
  );
};

export default EditMatchRound;
