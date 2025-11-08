import React, { useCallback, useContext, useState } from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';
import Draft from '@utils/datatypes/Draft';

import { Flexbox } from './base/Layout';
import Pagination from './base/Pagination';
import DeckPreview from './DeckPreview';

interface CubesCardProps {
  decks: Draft[];
  lastKey: any;
}

const PAGE_SIZE = 10;

const RecentDraftsCard: React.FC<CubesCardProps> = ({ decks, lastKey }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [items, setItems] = useState<Draft[]>(decks);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const fetchMoreData = useCallback(async () => {
    setLoading(true);
    const response = await csrfFetch(`/getmoredecks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.items]);
        setPage(page + 1);
        setLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [currentLastKey, items, page]);

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        console.log(newPage, pageCount);
        if (newPage >= pageCount) {
          await fetchMoreData();
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
            Drafts of your Cubes ({items.length}
            {hasMore ? '+' : ''})
          </Text>
          {decks.length > 0 && pager}
        </Flexbox>
      </CardHeader>
      {decks.length > 0 ? (
        <>
          {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((deck) => (
            <DeckPreview key={deck.id} deck={deck} nextURL="/dashboard" />
          ))}
          <CardBody>
            <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
              {pager}
            </Flexbox>
          </CardBody>
        </>
      ) : (
        <CardBody>
          <Text>
            Nobody has drafted your cubes! Perhaps try reaching out on the{' '}
            <Link href="https://discord.gg/YYF9x65Ane">Discord draft exchange?</Link>
          </Text>
        </CardBody>
      )}
    </Card>
  );
};

export default RecentDraftsCard;
