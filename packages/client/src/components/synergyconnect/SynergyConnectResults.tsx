import React, { useCallback, useState } from 'react';

import { SynergyConnectUserStats } from '@utils/datatypes/SynergyConnect';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { GROUP_EMOJI } from 'components/synergyconnect/groupStyles';

export interface SynergyConnectResultsProps {
  date: string;
  won: boolean;
  guesses: number[][];
  mistakes: number;
  stats: SynergyConnectUserStats | null;
  isArchive: boolean;
  // Anonymous players who ran out of lives don't get the answers revealed —
  // a public reveal endpoint would let anyone read the solution.
  canReveal: boolean;
}

const SynergyConnectResults: React.FC<SynergyConnectResultsProps> = ({
  date,
  won,
  guesses,
  mistakes,
  stats,
  isArchive,
  canReveal,
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const share = useCallback(async () => {
    const grid = guesses.map((guess) => guess.map((groupIndex) => GROUP_EMOJI[groupIndex % 4]).join('')).join('\n');
    const header = won ? `Solved with ${mistakes} mistake${mistakes === 1 ? '' : 's'}!` : 'Out of lives!';
    const text = `Synergy Connect ${date}\n${header}\n${grid}\nPlay at ${window.location.origin}/synergyconnect`;

    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  }, [guesses, won, mistakes, date]);

  return (
    <Flexbox direction="col" gap="2" alignItems="center">
      <Text semibold>{won ? `Solved with ${mistakes} mistake${mistakes === 1 ? '' : 's'}!` : 'Out of lives.'}</Text>

      {!canReveal && (
        <Text xs className="text-center text-text-secondary">
          <Link href="/user/login">Log in</Link> to see the answers and keep a streak.
        </Text>
      )}

      {/* The guess history, exactly as it shares. */}
      <Flexbox direction="col" gap="0" alignItems="center">
        {guesses.map((guess, index) => (
          <span key={index} className="text-lg leading-tight tracking-widest">
            {guess.map((groupIndex) => GROUP_EMOJI[groupIndex % 4]).join('')}
          </span>
        ))}
      </Flexbox>

      <Button color="secondary" onClick={share} className="text-sm">
        <span aria-live="polite">
          {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? "Couldn't copy" : 'Copy results'}
        </span>
      </Button>

      {stats && !isArchive && (
        <Flexbox direction="row" justify="center" gap="6" wrap="wrap">
          {[
            { value: stats.currentStreak, label: 'Current Streak' },
            { value: stats.longestStreak, label: 'Best Streak' },
            { value: stats.totalPlayed, label: 'Days Played' },
            { value: stats.perfectDays, label: 'Perfect Days' },
          ].map((stat) => (
            <Flexbox key={stat.label} direction="col" alignItems="center">
              <Text semibold lg>
                {stat.value}
              </Text>
              <Text xs className="text-text-secondary">
                {stat.label}
              </Text>
            </Flexbox>
          ))}
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default SynergyConnectResults;
