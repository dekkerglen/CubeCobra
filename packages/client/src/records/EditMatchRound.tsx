import React, { useId } from 'react';

import { Match, PlayerList, Round } from '@utils/datatypes/Record';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';

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
      {round.matches.map((match, index) => (
        <Flexbox key={index} direction="row" gap="2" alignItems="end">
          <Text sm>{`${index + 1}`}</Text>
          <Select
            id={`${idPrefix}-match-${index}-p1`}
            label="Player 1"
            value={match.p1}
            setValue={(value) => updateMatch(index, { p1: value })}
            options={playerOptions}
          />
          <Select
            id={`${idPrefix}-match-${index}-p2`}
            label="Player 2"
            value={match.p2}
            setValue={(value) => updateMatch(index, { p2: value })}
            options={playerOptions}
          />
          <Input
            id={`${idPrefix}-match-${index}-p1-wins`}
            label={`${match.p1} Wins`}
            type="number"
            value={`${match.results[0]}`}
            onChange={(e) => updateResult(index, 0, e.target.value)}
            otherInputProps={{ min: 0, max: 100 }}
          />
          <Input
            id={`${idPrefix}-match-${index}-p2-wins`}
            label={`${match.p2} Wins`}
            type="number"
            value={`${match.results[1]}`}
            onChange={(e) => updateResult(index, 1, e.target.value)}
            otherInputProps={{ min: 0, max: 100 }}
          />
          <Input
            id={`${idPrefix}-match-${index}-draws`}
            label="Draws"
            type="number"
            value={`${match.results[2]}`}
            onChange={(e) => updateResult(index, 2, e.target.value)}
            otherInputProps={{ min: 0, max: 100 }}
          />
          <Button
            onClick={() => {
              const newMatches = [...round.matches];
              newMatches.splice(index, 1);
              setRound({ ...round, matches: newMatches });
            }}
            color="danger"
          >
            <span className="text-nowrap">Remove Match</span>
          </Button>
        </Flexbox>
      ))}
      <Button
        onClick={() => {
          const newMatch: Match = {
            p1: 'Unknown Opponent',
            p2: 'Unknown Opponent',
            results: [0, 0, 0],
          };
          setRound({ ...round, matches: [...round.matches, newMatch] });
        }}
        color="primary"
      >
        Add Match
      </Button>
    </Flexbox>
  );
};

export default EditMatchRound;
