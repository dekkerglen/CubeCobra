import React, { useContext } from 'react';

import { KebabHorizontalIcon } from '@primer/octicons-react';
import Record from '@utils/datatypes/Record';

import { CardBody } from 'components/base/Card';
import Dropdown from 'components/base/Dropdown';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { SafeMarkdown } from 'components/Markdown';
import RecordDeleteModal from 'components/modals/RecordDeleteModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';

const DeleteRecordLink = withModal(Link, RecordDeleteModal);

interface RecordOverviewProps {
  record: Record;
}

/**
 * The record's header block, shown at the top of the page (no longer a tab): name, date,
 * description, and the actions that apply to the record as a whole.
 *
 * Running an event is not one of those. Seating and Collect Decks used to sit here too, which
 * put two owner-only stages of an event beside two things anyone does to a record — and left
 * the event's third stage (Record Matches) on the Matches tab. Each stage now lives on the tab
 * holding what it acts on.
 */
const RecordOverview: React.FC<RecordOverviewProps> = ({ record }) => {
  const { canEdit } = useContext(CubeContext);

  const isOwner = canEdit;

  return (
    <CardBody>
      <Flexbox direction="col" gap="1">
        {/* Title and date on the left, actions on the right. Stacked on narrow viewports, which
            puts the actions directly under the date rather than squeezing them beside a
            wrapped title; side by side from md up, where they read as part of the title row
            rather than as a separate band of page chrome. The description sits below both, so
            it spans the full width at every size. */}
        <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-4">
          <Flexbox direction="col" gap="1">
            <Text xl semibold>
              {record.name}
            </Text>
            <Text md className="text-text-secondary">
              <FormatttedDate date={record.date} />
            </Text>
          </Flexbox>
          <Flexbox direction="row" gap="4" wrap="wrap" alignItems="center" className="shrink-0">
            {/* Named for what it exports: the cube hero's own Export button is on screen at the
                same time and exports the cube's card list instead. */}
            <Link href={`/cube/records/export/${record.cube}?record=${encodeURIComponent(record.id)}`} download>
              Export Record
            </Link>
            {isOwner && <Link href={`/cube/records/enter/${record.id}`}>Edit Record</Link>}
            {isOwner && (
              <Dropdown
                trigger={
                  <Link className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2">
                    <KebabHorizontalIcon size={16} />
                    More
                  </Link>
                }
                // These actions sit at the right edge of the card, so the menu hangs from that
                // edge; aligned left it would open past it.
                align="right"
                minWidth="16rem"
              >
                <Flexbox direction="col" gap="2" className="p-3">
                  {/* Behind the menu rather than in the row, so deleting a record is never one
                      slip from exporting it. Deleting was previously reachable only from the
                      record list, which meant leaving the record to get rid of it. */}
                  <DeleteRecordLink
                    className="!text-danger hover:!text-link-active hover:cursor-pointer font-medium"
                    modalprops={{ recordId: record.id, redirectTo: `/cube/records/${record.cube}` }}
                  >
                    Delete Record
                  </DeleteRecordLink>
                </Flexbox>
              </Dropdown>
            )}
          </Flexbox>
        </div>
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
