import React, { useContext } from 'react';

import Record from '@utils/datatypes/Record';

import { CardBody } from 'components/base/Card';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { SafeMarkdown } from 'components/Markdown';
import EditRecordOverviewModal from 'components/modals/EditRecordOverviewModal';
import ShareRecordModal from 'components/modals/ShareRecordModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

const EditRecordOverviewLink = withModal(Link, EditRecordOverviewModal);
const ShareRecordLink = withModal(Link, ShareRecordModal);

interface RecordOverviewProps {
  record: Record;
}

// The record's header block, shown at the top of the page (no longer a tab):
// name, date, description, and owner controls.
const RecordOverview: React.FC<RecordOverviewProps> = ({ record }) => {
  const { cube } = useContext(CubeContext);
  const user = useContext(UserContext);

  const isOwner = user && cube && user.id === cube.owner.id;

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
        {isOwner && (
          <Flexbox direction="row" gap="4" wrap="wrap" className="mt-1">
            <EditRecordOverviewLink modalprops={{ record }}>Edit overview</EditRecordOverviewLink>
            <ShareRecordLink modalprops={{ record }}>Share link to collect decks</ShareRecordLink>
          </Flexbox>
        )}
      </Flexbox>
    </CardBody>
  );
};

export default RecordOverview;
