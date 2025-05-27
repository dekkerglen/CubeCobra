import React from 'react';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import { PlayerList, Round } from 'datatypes/Record';

interface EditMatchRoundProps {
  players: PlayerList;
  round: Round;
  setRound: (round: Round) => void;
}

const EditMatchRound: React.FC<EditMatchRoundProps> = ({ round, players, setRound }) => {
  const playerOptions = [
    { label: 'Unknown Opponent', value: 'Unknown Opponent' },
    ...(players?.map((player) => ({
      label: player.name,
      value: player.name,
    })) || []),
  ];

  return (
    <Flexbox direction="col" gap="2">
      {round.matches.map((match, index) => (
        <Flexbox key={index} direction="row" gap="2">
          <Text sm>{`${index + 1}`}</Text>
          <Select
            label="Player 1"
            value={match.p1}
            setValue={(value) => {
              const newMatches = [...round.matches];
              newMatches[index] = { ...newMatches[index], p1: value };
              setRound({ ...round, matches: newMatches });
            }}
            options={playerOptions}
          />
          <Select
            label="Player 2"
            value={match.p2}
            setValue={(value) => {
              const newMatches = [...round.matches];
              newMatches[index] = { ...newMatches[index], p2: value };
              setRound({ ...round, matches: newMatches });
            }}
            options={playerOptions}
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
          const newMatch = {
            p1: 'Unknown Opponent',
            p2: 'Unknown Opponent',
            results: [0, 0, 0] as [number, number, number],
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
