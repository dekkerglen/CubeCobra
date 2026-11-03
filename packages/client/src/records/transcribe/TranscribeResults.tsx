import React, { useId, useState } from 'react';

import Record, { formatRecord, PlayerList, playerRecord, Round, WinLossDraw } from '@utils/datatypes/Record';
import classNames from 'classnames';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

import EditMatchRound from '../EditMatchRound';

// The server caps a record at 50 rounds. Adding past that is refused here rather than at Save.
export const MAX_ROUNDS = 50;

type ResultsMode = 'pairings' | 'records';

const EMPTY_RECORD: WinLossDraw = { wins: 0, losses: 0, draws: 0 };

interface TranscribeResultsProps {
  players: PlayerList;
  matches: Round[];
  setMatches: (matches: Round[]) => void;
  overrides: { [playerName: string]: WinLossDraw | undefined };
  setOverride: (playerName: string, value: WinLossDraw | undefined) => void;
}

// Two ways into the same standings: transcribe every pairing, or just type each player's
// final record. Someone working from a standings sheet has the latter and nothing else.
const TranscribeResults: React.FC<TranscribeResultsProps> = ({
  players,
  matches,
  setMatches,
  overrides,
  setOverride,
}) => {
  const idPrefix = useId();
  const hasOverrides = Object.values(overrides).some(Boolean);
  const hasPairings = matches.some((round) => round.matches.length > 0);
  // Open on whichever side the record already carries, so a standings-only record doesn't
  // land on an empty pairings list.
  const [mode, setMode] = useState<ResultsMode>(hasOverrides && !hasPairings ? 'records' : 'pairings');

  const updateRound = (index: number, round: Round) =>
    setMatches(matches.map((existing, position) => (position === index ? round : existing)));

  const derived = (playerName: string): WinLossDraw => playerRecord({ matches, overrides: {} } as Record, playerName);

  return (
    <Flexbox direction="col" gap="2">
      <Flexbox direction="row" gap="2" alignItems="center">
        {[
          { value: 'pairings' as const, label: 'Pairings' },
          { value: 'records' as const, label: 'Final records only' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={classNames(
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              mode === option.value ? 'border-link bg-bg-active' : 'border-border hover:bg-bg-active',
            )}
          >
            {option.label}
          </button>
        ))}
      </Flexbox>

      {hasOverrides && hasPairings && (
        <Alert color="warning">
          <Text sm>
            A final record takes precedence over the pairings, so a player who has one keeps it no matter what their
            matches add up to. Clear a final record to let their pairings decide it.
          </Text>
        </Alert>
      )}

      {mode === 'pairings' ? (
        <Flexbox direction="col" gap="2">
          {matches.map((round, index) => (
            <Card key={index}>
              <CardHeader>
                <Flexbox direction="row" justify="between" alignItems="center">
                  <Text semibold>{`Round ${index + 1}`}</Text>
                  <Button
                    color="danger"
                    onClick={() => setMatches(matches.filter((_, position) => position !== index))}
                  >
                    <span className="text-nowrap">Remove Round</span>
                  </Button>
                </Flexbox>
              </CardHeader>
              <CardBody>
                <EditMatchRound players={players} round={round} setRound={(value) => updateRound(index, value)} />
              </CardBody>
            </Card>
          ))}
          <Button
            color="primary"
            onClick={() => setMatches([...matches, { matches: [] }])}
            disabled={matches.length >= MAX_ROUNDS}
          >
            Add Round
          </Button>
        </Flexbox>
      ) : (
        <Flexbox direction="col" gap="2">
          <Text sm className="text-text-secondary">
            Leave a player alone to let their pairings decide their record.
          </Text>
          {players.map((player, index) => {
            const override = overrides[player.name];
            const value = override ?? EMPTY_RECORD;
            const update = (changes: Partial<WinLossDraw>) => setOverride(player.name, { ...value, ...changes });

            return (
              <Flexbox key={player.name} direction="row" gap="2" alignItems="end" wrap="wrap">
                <Text sm className="w-40 truncate">
                  {player.name}
                </Text>
                <Input
                  id={`${idPrefix}-${index}-wins`}
                  label="Wins"
                  type="number"
                  value={`${value.wins}`}
                  onChange={(e) => update({ wins: Number(e.target.value) })}
                  otherInputProps={{ min: 0 }}
                />
                <Input
                  id={`${idPrefix}-${index}-losses`}
                  label="Losses"
                  type="number"
                  value={`${value.losses}`}
                  onChange={(e) => update({ losses: Number(e.target.value) })}
                  otherInputProps={{ min: 0 }}
                />
                <Input
                  id={`${idPrefix}-${index}-draws`}
                  label="Draws"
                  type="number"
                  value={`${value.draws}`}
                  onChange={(e) => update({ draws: Number(e.target.value) })}
                  otherInputProps={{ min: 0 }}
                />
                <Button color="secondary" disabled={!override} onClick={() => setOverride(player.name, undefined)}>
                  <span className="text-nowrap">Clear</span>
                </Button>
                {!override && (
                  <Text sm className="text-text-secondary">
                    {`From pairings: ${formatRecord(derived(player.name))}`}
                  </Text>
                )}
              </Flexbox>
            );
          })}
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default TranscribeResults;
