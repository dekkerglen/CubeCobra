import React, { useCallback, useState } from 'react';
import { Card, CardFooter, CardHeader } from 'components/base/Card';
import DeckPreview from 'components/DeckPreview';
import Draft from 'datatypes/Draft';
import Text from 'components/base/Text';
import { Flexbox } from './base/Layout';
import Pagination from './base/Pagination';
import { csrfFetch } from 'utils/CSRF';

interface PlaytestDecksCardProps {
  decks: Draft[];
  decksLastKey: any;
  cubeId: string;
}

const PAGE_SIZE = 25;

const PlaytestDecksCard: React.FC<PlaytestDecksCardProps> = ({ decks, decksLastKey, cubeId }) => {
  const [page, setPage] = React.useState(0);
  const [items, setItems] = React.useState<Draft[]>(decks);
  const [lastKey, setLastKey] = useState(decksLastKey);
  const [loading, setLoading] = useState(false);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!lastKey;

  const fetchMore = useCallback(async () => {
    setLoading(true);
    const response = await csrfFetch(`/cube/getmoredecks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cubeId,
        lastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();

      setLastKey(json.lastKey);
      setItems([...items, ...json.decks]);
      setPage(page + 1);
      setLoading(false);
    }
  }, [page]);

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        console.log(newPage, pageCount);
        if (newPage >= pageCount) {
          await fetchMore();
        } else {
          setPage(newPage);
        }
      }}
      loading={loading}
    />
  );

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
          <Text lg semibold>
            Decks ({items.length}
            {hasMore ? '+' : ''})
          </Text>
          {pager}
        </Flexbox>
      </CardHeader>
      {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((deck) => (
        <DeckPreview key={deck.id} deck={deck} />
      ))}
      <CardFooter>
        <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
          {pager}
        </Flexbox>
      </CardFooter>
    </Card>
  );
};

export default PlaytestDecksCard;
