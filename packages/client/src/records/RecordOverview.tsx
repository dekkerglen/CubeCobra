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
        {/* Title and actions share one row: the actions belong to this record, and on their own
            row they read as a separate band of page chrome. They wrap below the title rather
            than squeezing it when a long name leaves no room. */}
        <Flexbox direction="row" justify="between" alignItems="center" gap="4" wrap="wrap">
          <Text xl semibold>
            {record.name}
          </Text>
          <Flexbox direction="row" gap="4" wrap="wrap" alignItems="center" className="shrink-0">
            {isOwner && <ShareRecordLink modalprops={{ record }}>Collect Decks</ShareRecordLink>}
            <Link href={`/cube/records/export/${record.cube}?record=${encodeURIComponent(record.id)}`} download>
              Export
            </Link>
            {isOwner && <Link href={`/cube/records/enter/${record.id}`}>Edit Record</Link>}
          </Flexbox>
        </Flexbox>
        <Text md className="text-text-secondary">
          <FormatttedDate date={record.date} />
        </Text>
        {record.description && (
          <div className="mt-1">
            <SafeMarkdown markdown={record.description} />
          </div>
        )}
      </Flexbox>
    </CardBody>
  );
};

export default RecordOverview;
