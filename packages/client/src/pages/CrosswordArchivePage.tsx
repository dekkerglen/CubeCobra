import React, { useCallback, useContext, useEffect, useState } from 'react';

import { CrosswordSubmission, CrosswordUserStats } from '@utils/datatypes/Crossword';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import { formatDuration } from 'components/crossword/crosswordShape';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';

interface ArchiveEntry {
  date: string;
  size: number;
  slots: number;
}

interface CrosswordArchivePageProps {
  history: ArchiveEntry[];
  hasMore: boolean;
  lastKey?: string | null;
}

const formatDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * What one row says about the viewer's run. A submission exists from the moment
 * they opened the puzzle, so "opened but never touched" reads as not played.
 */
const describeRun = (run: CrosswordSubmission): string | null => {
  if (run.solved) {
    const time = run.completionTimeMs !== undefined ? formatDuration(run.completionTimeMs) : 'solved';
    const aids: string[] = [];
    if (run.checks > 0) {
      aids.push(`${run.checks} check${run.checks === 1 ? '' : 's'}`);
    }
    if (run.reveals > 0) {
      aids.push(`${run.reveals} reveal${run.reveals === 1 ? '' : 's'}`);
    }
    return aids.length > 0 ? `${time} · ${aids.join(', ')}` : time;
  }
  if (run.attempts > 0 || run.reveals > 0) {
    return 'In progress';
  }
  return null;
};

const CrosswordArchivePage: React.FC<CrosswordArchivePageProps> = ({
  history: initialHistory,
  hasMore: initialHasMore,
  lastKey: initialLastKey,
}) => {
  const user = useContext(UserContext);
  const [history, setHistory] = useState(initialHistory);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(initialLastKey || null);
  const [stats, setStats] = useState<CrosswordUserStats | null>(null);
  const [myRuns, setMyRuns] = useState<Record<string, CrosswordSubmission>>({});
  const [meLastKey, setMeLastKey] = useState<string | null>(null);
  const [meHasMore, setMeHasMore] = useState(false);

  const fetchMyResults = useCallback(async (cursor: string | null) => {
    try {
      const response = await fetch('/tool/api/crossword/me' + (cursor ? `?lastKey=${encodeURIComponent(cursor)}` : ''));
      const data = await response.json();
      if (!data.success) {
        return;
      }

      if (data.stats) {
        setStats(data.stats);
      }
      setMyRuns((prev) => {
        const next = { ...prev };
        for (const run of data.submissions as CrosswordSubmission[]) {
          next[run.date] = run;
        }
        return next;
      });
      setMeHasMore(data.hasMore);
      setMeLastKey(data.lastKey);
    } catch (error) {
      console.error('Error loading crossword user data:', error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchMyResults(null);
    }
  }, [user, fetchMyResults]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const historyPromise = fetch(
        '/tool/api/crossword/history' + (lastKey ? `?lastKey=${encodeURIComponent(lastKey)}` : ''),
      );
      // Advance the runs cursor alongside the puzzle list so older rows still show
      // the user's results.
      const mePromise = user && meHasMore ? fetchMyResults(meLastKey) : Promise.resolve();

      const response = await historyPromise;
      const data = await response.json();

      if (data.success) {
        setHistory((prev) => [...prev, ...data.history]);
        setHasMore(data.hasMore);
        setLastKey(data.lastKey);
      }
      await mePromise;
    } catch (error) {
      console.error('Error loading more crossword history:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, lastKey, user, meHasMore, meLastKey, fetchMyResults]);

  return (
    <MainLayout>
      <DynamicFlash />
      <Card className="mx-auto my-2 w-full max-w-3xl">
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
            <Text lg semibold>
              Crossword Archive
            </Text>
            <Link href="/tool/crossword">Today's Puzzle</Link>
          </Flexbox>
        </CardHeader>

        {user && stats && (
          <div className="border-b border-border px-4 py-3">
            <Flexbox direction="row" justify="center" gap="6" wrap="wrap">
              {[
                { value: `${stats.currentStreak}`, label: 'Current Streak' },
                { value: `${stats.longestStreak}`, label: 'Best Streak' },
                { value: `${stats.totalSolved}`, label: 'Solved' },
                { value: `${stats.perfectDays}`, label: 'Unaided' },
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
          </div>
        )}

        {history.map((entry) => {
          const mine = myRuns[entry.date];
          const result = mine ? describeRun(mine) : null;

          return (
            <a
              key={entry.date}
              href={`/tool/crossword/${entry.date}`}
              className="block border-b border-border px-4 py-3 no-underline-hover hover:bg-bg-active"
            >
              <Flexbox direction="row" justify="between" alignItems="center" gap="3" wrap="wrap">
                <Flexbox direction="col" gap="1" className="min-w-0">
                  <Text semibold md>
                    {formatDate(entry.date)}
                  </Text>
                  <Text xs className="text-text-secondary">
                    {entry.size}×{entry.size} · {entry.slots} clues
                  </Text>
                </Flexbox>
                <Flexbox direction="row" gap="3" alignItems="center" className="shrink-0">
                  {result ? (
                    <Text sm className="whitespace-nowrap font-mono tabular-nums text-text-secondary">
                      {result}
                    </Text>
                  ) : (
                    <Text sm className="whitespace-nowrap text-link">
                      Play →
                    </Text>
                  )}
                </Flexbox>
              </Flexbox>
            </a>
          );
        })}

        <CardBody>
          <Flexbox direction="col" gap="2" alignItems="center">
            {loading && <Spinner />}

            {!loading && hasMore && (
              <Button color="secondary" onClick={loadMore}>
                Load More
              </Button>
            )}

            {!hasMore && history.length > 0 && (
              <Text xs className="text-text-secondary">
                That's every puzzle so far.
              </Text>
            )}

            {history.length === 0 && (
              <Text className="text-text-secondary">No puzzles available yet. Check back tomorrow!</Text>
            )}
          </Flexbox>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(CrosswordArchivePage);
