import React, { useContext } from 'react';

import Record from '@utils/datatypes/Record';

import { CardBody } from 'components/base/Card';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { SafeMarkdown } from 'components/Markdown';
import ShareRecordModal from 'components/modals/ShareRecordModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';

const ShareRecordLink = withModal(Link, ShareRecordModal);

interface RecordOverviewProps {
  record: Record;
}

// The record's header block, shown at the top of the page (no longer a tab):
// name, date, description, and owner controls.
const RecordOverview: React.FC<RecordOverviewProps> = ({ record }) => {
  const { canEdit } = useContext(CubeContext);

  const isOwner = canEdit;

  return (
    <CardBody>
      <Flexbox direction="col" gap="1">
        <Text xl semibold>
          {record.name}
        </Text>
        <Text md className="text-text-secondary">
          <FormatttedDate date={record.date} />
        </Text>
        {record.description && (
          <div className="mt-1">
            <SafeMarkdown markdown={record.description} />
          </div>
        )}
        <Flexbox direction="row" gap="4" wrap="wrap" className="mt-1" justify="end">
          {isOwner && <ShareRecordLink modalprops={{ record }}>Collect Decks</ShareRecordLink>}
          <Link href={`/cube/records/export/${record.cube}?record=${encodeURIComponent(record.id)}`} download>
            Export
          </Link>
          {isOwner && <Link href={`/cube/records/enter/${record.id}`}>Edit Record</Link>}
        </Flexbox>
      </Flexbox>
    </CardBody>
  );
};

export default RecordOverview;
