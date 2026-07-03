import React, { useContext, useState } from 'react';

import { XIcon } from '@primer/octicons-react';
import Record from '@utils/datatypes/Record';

import Button from 'components/base/Button';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import IndefinitePaginatedTable from 'components/IndefinitePaginatedTable';
import RecordDeleteModal from 'components/modals/RecordDeleteModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

const RecordDeleteModalButton = withModal(Button, RecordDeleteModal);
interface DraftReportsProps {
  records: Record[];
  lastKey: any;
}

const PAGE_SIZE = 20;

const DraftReports: React.FC<DraftReportsProps> = ({ records, lastKey }) => {
  const [items, setItems] = useState<Record[]>(records);
  const [lastKeyState, setLastKeyState] = useState<any>(lastKey);
  const { cube } = useContext(CubeContext);
  const user = useContext(UserContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  const renderItem = (record: Record) => ({
    Name: <Link href={`/cube/record/${record.id}`}>{record.name}</Link>,
    Date: <FormatttedDate date={record.date} />,
    Players: (
      <Flexbox direction="row" gap="1">
        {record.players.map((player, index) => {
          if (player.userId) {
            return (
              <React.Fragment key={player.userId}>
                <Link href={`/user/view/${player.userId}`}>
                  <Text sm>{player.name}</Text>
                </Link>
                {index < record.players.length - 1 && <Text sm>, </Text>}
              </React.Fragment>
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
    '': isOwner && (
      <RecordDeleteModalButton modalprops={{ recordId: record.id }} color="secondary">
        <XIcon size={16} className="mx-1" />
      </RecordDeleteModalButton>
    ),
  });

  return (
    <IndefinitePaginatedTable
      items={items}
      setItems={setItems}
      itemsKey="records"
      lastKey={lastKeyState}
      setLastKey={setLastKeyState}
      pageSize={PAGE_SIZE}
      header="Draft Reports"
      fetchMoreRoute={`/cube/records/list/${cube.id}`}
      renderItem={renderItem}
      noneMessage="No draft reports to show, create a new report to get started!"
      headers={['Name', 'Date', 'Players', '']}
      inCard
    />
  );
};

export default DraftReports;
