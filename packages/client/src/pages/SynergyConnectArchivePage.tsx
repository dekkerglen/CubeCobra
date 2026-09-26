import React, { useCallback, useContext, useEffect, useState } from 'react';

import {
  SYNERGY_CONNECT_MAX_MISTAKES,
  SynergyConnectSubmission,
  SynergyConnectUserStats,
} from '@utils/datatypes/SynergyConnect';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { GROUP_EMOJI } from 'components/synergyconnect/groupStyles';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';

interface ArchiveEntry {
  date: string;
  theme: { filterText: string; description: string };
}

interface SynergyConnectArchivePageProps {
  history: ArchiveEntry[];
  hasMore: boolean;
  lastKey?: string | null;
}

const formatDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const SynergyConnectArchivePage: React.FC<SynergyConnectArchivePageProps> = ({
  history: initialHistory,
  hasMore: initialHasMore,
  lastKey: initialLastKey,
}) => {
  const user = useContext(UserContext);
  const [history, setHistory] = useState(initialHistory);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(initialLastKey || null);
  const [stats, setStats] = useState<SynergyConnectUserStats | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Record<string, SynergyConnectSubmission>>({});
  const [meLastKey, setMeLastKey] = useState<string | null>(null);
  const [meHasMore, setMeHasMore] = useState(false);

  const fetchMyResults = useCallback(async (cursor: string | null) => {
    try {
      const response = await fetch(
        '/tool/api/synergyconnect/me' + (cursor ? `?lastKey=${encodeURIComponent(cursor)}` : ''),
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
        for (const submission of data.submissions as SynergyConnectSubmission[]) {
          next[submission.date] = submission;
        }
        return next;
      });
      setMeHasMore(data.hasMore);
      setMeLastKey(data.lastKey);
    } catch (error) {
      console.error('Error loading Synergy Connect user data:', error);
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
        '/tool/api/synergyconnect/history' + (lastKey ? `?lastKey=${encodeURIComponent(lastKey)}` : ''),
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
      console.error('Error loading more Synergy Connect history:', error);
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
              Synergy Connect Archive
            </Text>
            <Link href="/tool/synergyconnect">Today's Puzzle</Link>
          </Flexbox>
        </CardHeader>

        {user && stats && (
          <div className="border-b border-border px-4 py-3">
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
          </div>
        )}

        {history.map((entry) => {
          const mine = mySubmissions[entry.date];
          const won = mine ? mine.solvedGroups.length >= 4 : false;
          const lost = mine ? mine.mistakes >= SYNERGY_CONNECT_MAX_MISTAKES : false;

          return (
            <a
              key={entry.date}
              href={`/tool/synergyconnect/${entry.date}`}
              className="block border-b border-border px-4 py-3 no-underline-hover hover:bg-bg-active"
            >
              <Flexbox direction="row" justify="between" alignItems="center" gap="3" wrap="wrap">
                <Flexbox direction="col" gap="1" className="min-w-0">
                  <Text semibold md>
                    {formatDate(entry.date)}
                  </Text>
                  <Text xs className="text-text-secondary">
                    Legendary creatures {entry.theme.description}
                  </Text>
                </Flexbox>
                <Flexbox direction="row" gap="3" alignItems="center" className="shrink-0">
                  {mine ? (
                    <>
                      <Text sm className="whitespace-nowrap text-text-secondary">
                        {won
                          ? `Solved · ${mine.mistakes} mistake${mine.mistakes === 1 ? '' : 's'}`
                          : lost
                            ? 'Out of lives'
                            : `${mine.solvedGroups.length}/4 in progress`}
                      </Text>
                      <span className="text-xs tracking-widest" aria-hidden>
                        {mine.solvedGroups.map((groupIndex) => GROUP_EMOJI[groupIndex % 4]).join('')}
                      </span>
                    </>
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

export default RenderToRoot(SynergyConnectArchivePage);
