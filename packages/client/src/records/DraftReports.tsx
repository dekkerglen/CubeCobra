import React, { useContext, useState } from 'react';

import { XIcon } from '@primer/octicons-react';
import Record from '@utils/datatypes/Record';

import Button from 'components/base/Button';
import FormatttedDate from 'components/base/FormatttedDate';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import IndefinitePaginatedTable from 'components/IndefinitePaginatedTable';
import RecordDeleteModal from 'components/modals/RecordDeleteModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';

const RecordDeleteModalButton = withModal(Button, RecordDeleteModal);
interface DraftReportsProps {
  records: Record[];
  lastKey: any;
}

const PAGE_SIZE = 20;

const DraftReports: React.FC<DraftReportsProps> = ({ records, lastKey }) => {
  const [items, setItems] = useState<Record[]>(records);
  const [lastKeyState, setLastKeyState] = useState<any>(lastKey);
  const { cube, canEdit } = useContext(CubeContext);

  const isOwner = canEdit;

  // What distinguishes one record from another is how much is in it. The list used to carry a
  // raw comma-joined player list instead, which was blank for a record nobody had been added
  // to yet and a wall of names for a sixteen-player event — and said nothing about whether a
  // round had ever been played. Names live on the record page, where there is room for them.
  const renderItem = (record: Record) => ({
    Name: <Link href={`/cube/record/${record.id}`}>{record.name}</Link>,
    Date: <FormatttedDate date={record.date} />,
    Players: <Text sm>{record.players?.length ?? 0}</Text>,
    Rounds: <Text sm>{record.matches?.length ?? 0}</Text>,
    // An em dash rather than a blank: a record with no winner yet and a column that failed to
    // render look identical when both are empty.
    Winner: <Text sm>{record.trophy?.length ? record.trophy.join(', ') : '—'}</Text>,
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
      headers={['Name', 'Date', 'Players', 'Rounds', 'Winner', '']}
      // Name, date and a player count are what finds the record; the other two are detail.
      hideOnMobile={['Rounds', 'Winner']}
      inCard
    />
  );
};

export default DraftReports;
