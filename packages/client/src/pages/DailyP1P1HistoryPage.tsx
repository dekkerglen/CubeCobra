import React, { useCallback, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import { DailyP1P1 } from '@utils/datatypes/DailyP1P1';
import { P1P1Pack } from '@utils/datatypes/P1P1Pack';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import CardGrid from 'components/card/CardGrid';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

import { detailsToCard } from '../../../utils/src/cardutil';

interface DailyP1P1HistoryItem extends DailyP1P1 {
  pack: P1P1Pack;
  cube: Cube;
}

interface DailyP1P1HistoryPageProps {
  history: DailyP1P1HistoryItem[];
  hasMore: boolean;
  lastKey?: string | null;
}

const DailyP1P1HistoryPage: React.FC<DailyP1P1HistoryPageProps> = ({
  history: initialHistory,
  hasMore: initialHasMore,
  lastKey: initialLastKey,
}) => {
  const [history, setHistory] = useState(initialHistory);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(initialLastKey || null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await fetch('/tool/api/p1p1History/history' + (lastKey ? `?lastKey=${lastKey}` : ''));
      const data = await response.json();

      if (data.success) {
        setHistory((prev) => [...prev, ...data.history]);
        setHasMore(data.hasMore);
        setLastKey(data.lastKey);
      }
    } catch (error) {
      console.error('Error loading more daily P1P1 history:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, lastKey]);

  return (
    <MainLayout>
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Text semibold lg>
            Daily Pack 1 Pick 1 Archive
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="4">
            {history.map((item) => {
              const cards = item.pack.cards.map((card) => {
                return card.details ? detailsToCard(card.details) : card;
              });

              return (
                <Card key={item.id} className="border">
                  <CardHeader>
                    <Flexbox direction="row" justify="between" alignItems="center">
                      <Text semibold md>
                        {new Date(item.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Text>
                      <Button type="link" color="primary" href={`/tool/p1p1/${item.packId}`} className="text-sm">
                        View Pack
                      </Button>
                    </Flexbox>
                  </CardHeader>
                  <CardBody>
                    <Flexbox direction="col" gap="2">
                      <Text sm className="text-text-secondary">
                        From{' '}
                        <Link href={`/cube/primer/${item.cube.id}`} className="font-semibold">
                          {item.cube.name}
                        </Link>
                        {item.cube.owner?.username && (
                          <>
                            {' by '}
                            <Link href={`/user/view/${item.cube.owner.id}`}>{item.cube.owner.username}</Link>
                          </>
                        )}
                      </Text>

                      <CardGrid cards={cards} xs={3} md={5} lg={8} hrefFn={(card) => `/tool/card/${card.cardID}`} />
                    </Flexbox>
                  </CardBody>
                </Card>
              );
            })}

            {loading && (
              <Flexbox direction="row" justify="center" className="my-4">
                <Spinner />
              </Flexbox>
            )}

            {!loading && hasMore && (
              <Flexbox direction="row" justify="center" className="my-4">
                <Button color="primary" onClick={loadMore}>
                  Load More
                </Button>
              </Flexbox>
            )}

            {!hasMore && history.length > 0 && (
              <Text sm className="text-center text-text-secondary">
                No more daily P1P1 history to show
              </Text>
            )}

            {history.length === 0 && (
              <Text className="text-center text-text-secondary">
                No daily P1P1s available yet. Check back tomorrow!
              </Text>
            )}
          </Flexbox>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(DailyP1P1HistoryPage);
