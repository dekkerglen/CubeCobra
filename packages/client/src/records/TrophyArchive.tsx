import React, { useCallback, useContext, useMemo, useState } from 'react';

import { QuestionIcon } from '@primer/octicons-react';

import { CardBody } from 'components/base/Card';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Pagination from 'components/base/Pagination';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import { CSRFContext } from 'contexts/CSRFContext';
import Record from '@utils/datatypes/Record';

interface TrophyArchiveProps {
  records: Record[];
  lastKey: any;
}

const PAGE_SIZE = 20;

const TrophyArchive: React.FC<TrophyArchiveProps> = ({ records, lastKey }) => {
  const [items, setItems] = useState<Record[]>(records);
  const [lastKeyState, setLastKeyState] = useState<any>(lastKey);
  const [loading, setLoading] = useState<boolean>(false);
  const { csrfFetch } = useContext(CSRFContext);
  const [page, setPage] = React.useState(0);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!lastKeyState;

  const fetchMore = useCallback(async () => {
    if (loading || !lastKeyState) return;
    setLoading(true);
    try {
      const response = await csrfFetch('/api/draftreports', {
        method: 'POST',
        body: JSON.stringify({ lastKey: lastKeyState }),
      });
      const data = await response.json();
      if (data.reports) {
        setItems((prevItems) => [...prevItems, ...data.reports]);
        setLastKeyState(data.lastKey);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, lastKeyState, csrfFetch]);

  const trophyCount = useMemo(() => {
    return items.reduce((count, item) => count + item.trophy.length, 0);
  }, [items]);

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
                  <QuestionIcon size={16} />
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
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
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
    <>
      {items.length > 0 ? (
        <Flexbox direction="col" gap="2">
          <Flexbox direction="row" justify="between" alignItems="center" className="w-full p-4">
            <Text lg semibold>
              Trophies ({trophyCount}
              {hasMore ? '+' : ''})
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
