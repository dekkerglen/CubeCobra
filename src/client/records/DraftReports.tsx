import React, { useCallback, useContext, useState } from 'react';

import { XIcon } from '@primer/octicons-react';

import Button from 'components/base/Button';
import { CardBody } from 'components/base/Card';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Pagination from 'components/base/Pagination';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import RecordDeleteModal from 'components/modals/RecordDeleteModal';
import withModal from 'components/WithModal';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import Record from 'datatypes/Record';

const RecordDeleteModalButton = withModal(Button, RecordDeleteModal);
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
  const { cube } = useContext(CubeContext);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!lastKeyState;

  const fetchMore = useCallback(async () => {
    if (loading || !lastKeyState) return;
    setLoading(true);
    try {
      const response = await csrfFetch(`/cube/records/list/${cube.id}`, {
        method: 'POST',
        body: JSON.stringify({ lastKey: lastKeyState }),
      });
      const data = await response.json();
      if (data.records) {
        setItems((prevItems) => [...prevItems, ...data.records]);
        setLastKeyState(data.lastKey);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, lastKeyState, csrfFetch, cube.id]);

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
            headers={['Name', 'Date', 'Players', '']}
            rows={items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((record) => ({
              Name: <Link href={`/cube/record/${record.id}`}>{record.name}</Link>,
              Date: <FormatttedDate date={record.date} />,
              Players: (
                <Flexbox direction="row" gap="1">
                  {record.players.map((player, index) => {
                    if (player.userId) {
                      return (
                        <>
                          <Link key={player.userId} href={`/user/view/${player.userId}`}>
                            <Text sm>{player.name}</Text>
                          </Link>
                          {index < record.players.length - 1 && <Text sm>, </Text>}
                        </>
                      );
                    }

                    return (
                      <Text key={player.name} sm>
                        {player.name}
                        {index < record.players.length - 1 && <Text sm>, </Text>}
                      </Text>
                    );
                  })}
                </Flexbox>
              ),
              '': (
                <RecordDeleteModalButton modalprops={{ recordId: record.id }} color="secondary">
                  <XIcon size={16} className="mx-1" />
                </RecordDeleteModalButton>
              ),
            }))}
          />
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full p-4">
            {pager}
          </Flexbox>
        </Flexbox>
      ) : (
        <CardBody>
          <Text md>No draft reports to show, create a new report to get started!</Text>
        </CardBody>
      )}
    </>
  );
};

export default DraftReports;
