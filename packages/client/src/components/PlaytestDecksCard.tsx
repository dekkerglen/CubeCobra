import React, { useCallback, useContext, useState } from 'react';

import Draft from '@utils/datatypes/Draft';

import { Card, CardBody, CardFooter, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import DeckPreview from 'components/DeckPreview';
import { CSRFContext } from 'contexts/CSRFContext';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

import CursorPagination from './base/CursorPagination';
import { Flexbox } from './base/Layout';

interface PlaytestDecksCardProps {
  decks: Draft[];
  decksLastKey: any;
  cubeId: string;
}

const PAGE_SIZE = 25;

const PlaytestDecksCard: React.FC<PlaytestDecksCardProps> = ({ decks, decksLastKey, cubeId }) => {
  const { callApi } = useContext(CSRFContext);
  const [page, setPage] = React.useState(0);
  const [items, setItems] = React.useState<Draft[]>(decks);
  const [lastKey, setLastKey] = useState(decksLastKey);
  const [loading, setLoading] = useState(false);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(lastKey);

  const fetchMore = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<Draft>({
        callApi,
        fetchMoreRoute: `/cube/getmoredecks/${cubeId}`,
        items,
        setItems,
        lastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'decks',
        setLoading,
        targetPage,
        body: { cubeId },
      });
    },
    [callApi, cubeId, items, lastKey],
  );

  const pager = (
    <CursorPagination
      active={page}
      loadedPages={pageCount}
      hasMore={hasMore}
      onPageChange={async (newPage) => {
        await handleIndefinitePageSelection({
          newPage,
          pageCount,
          setPage,
          fetchMoreData: fetchMore,
        });
      }}
      loading={loading}
    />
  );

  const hasItems = items.length > 0;

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
          <Text lg semibold>
            Drafts
          </Text>
          {pager}
        </Flexbox>
      </CardHeader>
      {hasItems ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((deck) => (
              <DeckPreview key={deck.id} deck={deck} />
            ))}
          </div>
          <CardFooter>
            <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
              {pager}
            </Flexbox>
          </CardFooter>
        </>
      ) : (
        <CardBody>
          <Text className="text-text-secondary">No drafts yet.</Text>
        </CardBody>
      )}
    </Card>
  );
};

export default PlaytestDecksCard;
