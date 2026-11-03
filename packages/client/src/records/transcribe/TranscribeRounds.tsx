import React from 'react';

import { XIcon } from '@primer/octicons-react';
import { PlayerList, Round } from '@utils/datatypes/Record';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

import EditMatchRound from '../EditMatchRound';
import { MAX_ROUNDS } from './transcribeState';

// Two ways into the same standings: transcribe every pairing, or just type each player's
// final record. The page owns which one is being written down — this section is the pairings
// side of it and is not rendered at all in the other mode.
export type ResultsMode = 'pairings' | 'records';

// Rendered in the section's own header rather than under its list: at the bottom it sat
// below however many rounds were already entered, which is where it is least reachable.
export const AddRoundButton: React.FC<{ matches: Round[]; setMatches: (matches: Round[]) => void }> = ({
  matches,
  setMatches,
}) => (
  <Button
    color="primary"
    onClick={() => setMatches([...matches, { matches: [] }])}
    // The server caps a record at MAX_ROUNDS rounds. Adding past that is refused here
    // rather than at Save.
    disabled={matches.length >= MAX_ROUNDS}
  >
    <span className="text-nowrap">Add Round</span>
  </Button>
);

interface TranscribeRoundsProps {
  players: PlayerList;
  matches: Round[];
  setMatches: (matches: Round[]) => void;
}

const TranscribeRounds: React.FC<TranscribeRoundsProps> = ({ players, matches, setMatches }) => {
  const updateRound = (index: number, round: Round) =>
    setMatches(matches.map((existing, position) => (position === index ? round : existing)));

  if (matches.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        No rounds yet. Add one to start entering pairings.
      </Text>
    );
  }

  return (
    <Flexbox direction="col" gap="2">
      {matches.map((round, index) => (
        <Card key={index}>
          <CardHeader>
            <Flexbox direction="row" justify="between" alignItems="center">
              <Text semibold>{`Round ${index + 1}`}</Text>
              {/* Subtle for the same reason the per-match one is: removing an empty round
                  you just added is the common case, not a destructive act to be warned about. */}
              <button
                type="button"
                aria-label={`Remove round ${index + 1}`}
                className="shrink-0 text-text-secondary hover:text-red-600"
                onClick={() => setMatches(matches.filter((_, position) => position !== index))}
              >
                <XIcon size={16} />
              </button>
            </Flexbox>
          </CardHeader>
          <CardBody>
            <EditMatchRound players={players} round={round} setRound={(value) => updateRound(index, value)} />
          </CardBody>
        </Card>
      ))}
    </Flexbox>
  );
};

export default TranscribeRounds;
