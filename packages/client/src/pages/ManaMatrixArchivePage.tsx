import React, { useCallback, useContext, useEffect, useState } from 'react';

import { ManaMatrixPuzzle, ManaMatrixSubmission, ManaMatrixUserStats } from '@utils/datatypes/ManaMatrix';
import classNames from 'classnames';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import ManaMatrixBoardPreview from 'components/manamatrix/ManaMatrixBoardPreview';
import ManaMatrixStats from 'components/manamatrix/ManaMatrixStats';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';

interface ManaMatrixArchivePageProps {
  history: ManaMatrixPuzzle[];
  hasMore: boolean;
  lastKey?: string | null;
}

const formatDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * Tiny 3x3 recap of a played puzzle: one dot per cell. Solved cells are filled,
 * missed cells are hollow, so the map survives colorblindness; the adjacent
 * "n/9" text carries the totals for screen readers.
 */
const MiniResult: React.FC<{ correct: boolean[][] }> = ({ correct }) => (
  <div className="grid grid-cols-3 gap-0.5" aria-hidden>
    {correct.flat().map((cell, index) => (
      <div
        key={index}
        className={classNames('h-2 w-2 rounded-full', {
          'bg-green-500': cell,
          'border border-red-400': !cell,
        })}
      />
    ))}
  </div>
);

const ManaMatrixArchivePage: React.FC<ManaMatrixArchivePageProps> = ({
  history: initialHistory,
  hasMore: initialHasMore,
  lastKey: initialLastKey,
}) => {
  const user = useContext(UserContext);
  const [history, setHistory] = useState(initialHistory);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(initialLastKey || null);
  const [stats, setStats] = useState<ManaMatrixUserStats | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Record<string, ManaMatrixSubmission>>({});
  // Cursor for the user's own submission history. Both lists page newest-first
  // and submission dates are a subset of puzzle dates, so paging them in
  // lockstep keeps the loaded submissions covering the loaded puzzle range.
  const [meLastKey, setMeLastKey] = useState<string | null>(null);
  const [meHasMore, setMeHasMore] = useState(false);

  const fetchMyResults = useCallback(async (cursor: string | null) => {
    try {
      const response = await fetch(
        '/tool/api/manamatrix/me' + (cursor ? `?lastKey=${encodeURIComponent(cursor)}` : ''),
      );
      const data = await response.json();
      if (!data.success) {
        return;
      }

      if (data.stats) {
        setStats(data.stats);
      }
      setMySubmissions((prev) => {
        const next = { ...prev };
        for (const submission of data.submissions as ManaMatrixSubmission[]) {
          next[submission.date] = submission;
        }
        return next;
      });
      setMeHasMore(data.hasMore);
      setMeLastKey(data.lastKey);
    } catch (error) {
      console.error('Error loading ManaMatrix user data:', error);
    }
  }, []);

  // The user's own results, overlaid onto the puzzle list.
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
        '/tool/api/manamatrix/history' + (lastKey ? `?lastKey=${encodeURIComponent(lastKey)}` : ''),
      );
      // Advance the submissions cursor alongside the puzzle list so older rows
      // still show the user's results.
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
      console.error('Error loading more ManaMatrix history:', error);
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
              ManaMatrix Archive
            </Text>
            <Link href="/tool/manamatrix">Today's Puzzle</Link>
          </Flexbox>
        </CardHeader>

        {user && stats && (
          <div className="border-b border-border px-4 py-3">
            <ManaMatrixStats stats={stats} />
          </div>
        )}

        {history.map((puzzle) => {
          const mine = mySubmissions[puzzle.date];
          const solved = mine ? mine.correct.flat().filter(Boolean).length : null;

          return (
            <a
              key={puzzle.id}
              href={`/tool/manamatrix/${puzzle.date}`}
              className="block border-b border-border px-4 py-3 no-underline-hover hover:bg-bg-active"
            >
              <Flexbox direction="col" gap="2" alignItems="center">
                <Text semibold md>
                  {formatDate(puzzle.date)}
                </Text>
                {mine && solved !== null ? (
                  <Flexbox direction="row" gap="3" alignItems="center">
                    <Text sm className="whitespace-nowrap text-text-secondary">
                      {solved}/9 in {mine.attempts} guess{mine.attempts === 1 ? '' : 'es'}
                    </Text>
                    <MiniResult correct={mine.correct} />
                  </Flexbox>
                ) : (
                  <Text sm className="whitespace-nowrap text-link">
                    Play →
                  </Text>
                )}
                <ManaMatrixBoardPreview puzzle={puzzle} submission={mine} />
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

export default RenderToRoot(ManaMatrixArchivePage);
