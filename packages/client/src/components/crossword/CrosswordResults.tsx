import React, { useCallback, useState } from 'react';

import { CrosswordAnswer, CrosswordUserStats } from '@utils/datatypes/Crossword';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';

import { formatDuration } from './crosswordShape';

export interface CrosswordResultsProps {
  date: string;
  /** The recorded time, server-measured. Null for a run that wasn't persisted. */
  completionTimeMs: number | null;
  checks: number;
  reveals: number;
  stats: CrosswordUserStats | null;
  isArchive: boolean;
  /** Every entry, sent only once the puzzle is solved. */
  answers: CrosswordAnswer[] | null;
  /** Anonymous solvers get the time on screen but nothing recorded. */
  isAnonymous: boolean;
}

const aidsUsed = (checks: number, reveals: number): string => {
  const parts: string[] = [];
  if (checks > 0) {
    parts.push(`${checks} check${checks === 1 ? '' : 's'}`);
  }
  if (reveals > 0) {
    parts.push(`${reveals} reveal${reveals === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'no help';
};

const CrosswordResults: React.FC<CrosswordResultsProps> = ({
  date,
  completionTimeMs,
  checks,
  reveals,
  stats,
  isArchive,
  answers,
  isAnonymous,
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const share = useCallback(async () => {
    const time = completionTimeMs !== null ? formatDuration(completionTimeMs) : null;
    const headline = time ? `Solved in ${time} with ${aidsUsed(checks, reveals)}.` : 'Solved!';
    const text = `Cube Cobra Crossword — ${date}\n${headline}\nPlay at ${window.location.origin}/crossword`;

    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  }, [checks, completionTimeMs, date, reveals]);

  return (
    <Flexbox direction="col" gap="2" alignItems="center">
      <Text semibold>
        {completionTimeMs !== null
          ? `Solved in ${formatDuration(completionTimeMs)} with ${aidsUsed(checks, reveals)}.`
          : 'Solved!'}
      </Text>

      {isAnonymous && (
        <Text xs className="text-center text-text-secondary">
          <Link href="/user/login">Log in</Link> to have your time recorded and keep a streak.
        </Text>
      )}

      <Button color="secondary" onClick={share} className="text-sm">
        <span aria-live="polite">
          {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? "Couldn't copy" : 'Copy results'}
        </span>
      </Button>

      {stats && !isArchive && (
        <Flexbox direction="row" justify="center" gap="6" wrap="wrap">
          {[
            { value: `${stats.currentStreak}`, label: 'Current Streak' },
            { value: `${stats.longestStreak}`, label: 'Best Streak' },
            { value: `${stats.totalSolved}`, label: 'Solved' },
            { value: stats.bestTimeMs !== undefined ? formatDuration(stats.bestTimeMs) : '—', label: 'Best Time' },
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

      {answers && answers.length > 0 && (
        <Flexbox direction="col" gap="1" className="w-full">
          <Text sm semibold className="uppercase tracking-wide text-text-secondary">
            Answers
          </Text>
          <div className="grid w-full grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {answers.map((answer) => (
              <Flexbox key={answer.id} direction="row" gap="2" alignItems="baseline" className="min-w-0">
                <Text xs className="w-8 shrink-0 text-right text-text-secondary">
                  {answer.number}
                  {answer.direction === 'across' ? 'A' : 'D'}
                </Text>
                <Text sm semibold className="shrink-0">
                  {answer.text}
                </Text>
                {answer.display !== answer.text && (
                  <Text xs className="min-w-0 break-words italic text-text-secondary">
                    {answer.display}
                  </Text>
                )}
              </Flexbox>
            ))}
          </div>
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default CrosswordResults;
