import React, { useCallback, useContext, useState } from 'react';

import { CardBody } from 'components/base/Card';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Pagination from 'components/base/Pagination';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';
import Record from 'datatypes/Record';

interface DraftReportsProps {
  records: Record[];
  lastKey: any;
}

const PAGE_SIZE = 20;

const DraftReports: React.FC<DraftReportsProps> = ({ records, lastKey }) => {
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
              Draft Reports ({items.length}
              {hasMore ? '+' : ''})
            </Text>
            {pager}
          </Flexbox>
          <Table
            headers={['Name', 'Date', 'Players']}
            rows={items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((record) => ({
              Name: <Link href={`/cube/records/${record.id}`}>{record.name}</Link>,
              Date: <FormatttedDate date={record.date} />,
              Players: (
                <Flexbox direction="row" gap="1">
                  {record.players.map((player) => {
                    if (player.userId) {
                      return (
                        <Link key={player.userId} href={`/user/view/${player.userId}`}>
                          <Text sm>{player.name}</Text>
                        </Link>
                      );
                    }

                    return (
                      <Text key={player.name} sm>
                        {player.name}
                      </Text>
                    );
                  })}
                </Flexbox>
              ),
            }))}
          />
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full p-4">
            {pager}
          </Flexbox>
        </Flexbox>
      ) : (
        <CardBody>
          <Text md>
            No draft reports to show, start a new draft or upload a historical draft report to get started.
          </Text>
        </CardBody>
      )}
    </>
  );
};

export default DraftReports;
