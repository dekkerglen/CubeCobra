import React from 'react';

import { Round } from '@utils/datatypes/Record';

import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';

interface EditMatchRoundResultsProps {
  round: Round;
  setRound: (round: Round) => void;
}

const EditMatchRoundResults: React.FC<EditMatchRoundResultsProps> = ({ round, setRound }) => {
  return (
    <Flexbox direction="col" gap="2">
      {round.matches.map((match, index) => (
        <Flexbox direction="row" gap="1" justify="start" alignItems="end" key={index}>
          <Input
            label={`${match.p1} Wins`}
            type="number"
            value={`${match.results[0]}`}
            onChange={(e) => {
              const newMatches = [...round.matches];
              newMatches[index] = {
                ...newMatches[index],
                results: [Number(e.target.value), match.results[1], match.results[2]],
              };
              setRound({ ...round, matches: newMatches });
            }}
            min={0}
            max={100}
          />
          <Input
            label={`${match.p2} Wins`}
            type="number"
            value={`${match.results[1]}`}
            onChange={(e) => {
              const newMatches = [...round.matches];
              newMatches[index] = {
                ...newMatches[index],
                results: [match.results[0], Number(e.target.value), match.results[2]],
              };
              setRound({ ...round, matches: newMatches });
            }}
            min={0}
            max={100}
          />
          <Input
            label="Draws"
            type="number"
            value={`${match.results[2]}`}
            onChange={(e) => {
              const newMatches = [...round.matches];
              newMatches[index] = {
                ...newMatches[index],
                results: [match.results[0], match.results[1], Number(e.target.value)],
              };
              setRound({ ...round, matches: newMatches });
            }}
            min={0}
            max={100}
          />
        </Flexbox>
      ))}
    </Flexbox>
  );
};

export default EditMatchRoundResults;
