import React, { useCallback, useContext, useMemo, useState } from 'react';

import { QuestionIcon } from '@primer/octicons-react';
import Record from '@utils/datatypes/Record';

import { CardBody } from 'components/base/Card';
import CursorPagination from 'components/base/CursorPagination';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import { CSRFContext } from 'contexts/CSRFContext';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

interface TrophyArchiveProps {
  records: Record[];
  lastKey: any;
}

const PAGE_SIZE = 20;

const TrophyArchive: React.FC<TrophyArchiveProps> = ({ records, lastKey }) => {
  const [items, setItems] = useState<Record[]>(records);
  const [lastKeyState, setLastKeyState] = useState<any>(lastKey);
  const [loading, setLoading] = useState<boolean>(false);
  const { callApi } = useContext(CSRFContext);
  const [page, setPage] = React.useState(0);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(lastKeyState);

  const fetchMore = useCallback(
    async (targetPage: number) => {
      if (loading) return;

      await fetchIndefiniteMoreData<Record>({
        callApi,
        fetchMoreRoute: '/api/draftreports',
        items,
        setItems,
        lastKey: lastKeyState,
        setLastKey: setLastKeyState,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'reports',
        setLoading,
        targetPage,
      });
    },
    [loading, items, lastKeyState, callApi],
  );

  const trophies = useMemo(() => {
    const itemPage = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const result = [];

    for (const item of itemPage) {
      for (const trophy of item.trophy) {
        let player = item.players.find((p) => p.name === trophy) || { name: trophy, userId: '' };

        const playerIndex = item.players.findIndex((p) => p.name === trophy);
        if (playerIndex === -1) {
          player = { name: trophy, userId: '' };
        }

        result.push({
          Player: player.userId ? (
            <Link href={`/user/view/${player.userId}`}>
              <Text sm>{player.name}</Text>
            </Link>
          ) : (
            <Text sm>{player.name}</Text>
          ),
          'Draft Record': (
            <Link href={`/cube/record/${item.id}`}>
              <Text sm>
                {item.name} - <FormatttedDate date={item.date} />
              </Text>
            </Link>
          ),
          '': item.draft ? (
            playerIndex !== -1 ? (
              <Link href={`/cube/deck/${item.draft}?seat=${item.players.indexOf(player)}`}>
                <Text sm>View Deck</Text>
              </Link>
            ) : (
              <>
                <Text sm>Unable to find trophy winners deck</Text>&nbsp;
                <Tooltip text="Please ensure the Player names are aligned with the Trophy winner names.">
                  <QuestionIcon size={16} className="hidden md:inline" />
                </Tooltip>
              </>
            )
          ) : (
            <Text sm>No draft available</Text>
          ),
        });
      }
    }
    return result;
  }, [items, page]);

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

  return (
    <>
      {items.length > 0 ? (
        <Flexbox direction="col" gap="2">
          <Flexbox direction="row" justify="between" alignItems="center" className="w-full p-4">
            <Text lg semibold>
              Trophies
            </Text>
            {pager}
          </Flexbox>
          <Table headers={['Player', 'Draft Record', '']} rows={trophies} />
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full p-4">
            {pager}
          </Flexbox>
        </Flexbox>
      ) : (
        <CardBody>
          <Text md>
            No trophy decks available, start a new draft or upload a historical draft report to get started.
          </Text>
        </CardBody>
      )}
    </>
  );
};

export default TrophyArchive;
