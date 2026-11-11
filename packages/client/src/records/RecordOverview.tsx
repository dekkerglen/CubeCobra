import React, { useContext } from 'react';

import { KebabHorizontalIcon } from '@primer/octicons-react';
import Draft from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';

import Button from 'components/base/Button';
import { CardBody } from 'components/base/Card';
import Dropdown from 'components/base/Dropdown';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { SafeMarkdown } from 'components/Markdown';
import RecordDeleteModal from 'components/modals/RecordDeleteModal';
import ShareRecordModal from 'components/modals/ShareRecordModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';

import { RecordPlayersAction } from './RecordPlayers';

const DeleteRecordLink = withModal(Link, RecordDeleteModal);
const CollectDecksButton = withModal(Button, ShareRecordModal);

const menuLinkClass = '!text-text hover:!text-link-active hover:cursor-pointer font-medium';

interface RecordOverviewProps {
  record: Record;
  // Decides whether the seating action can rearrange the table or only add players.
  draft?: Draft;
}

/**
 * The record's header block, shown at the top of the page (no longer a tab): name, date, the
 * actions for running the event, the actions for the record itself, and the description.
 *
 * The two kinds of action are not interchangeable. Running an event is a sequence of stages,
 * each owner-only and used once; exporting and editing are things done to a record as an
 * object, one of them by anyone. The stages were briefly moved onto the tab holding what each
 * acts on, which buried them — a right-aligned text link inside a tab is not where anyone looks
 * for the first thing they have to do. They are buttons under the name instead, where the
 * record identifies itself, and the record-level actions keep the quieter row opposite.
 *
 * Record Matches, the third stage, stays on the Matches tab: it is used repeatedly rather than
 * once, while looking at the matches it creates, and it is already that tab's empty-state
 * action — bringing it up here would empty that state again.
 */
const RecordOverview: React.FC<RecordOverviewProps> = ({ record, draft }) => {
  const { canEdit } = useContext(CubeContext);

  const isOwner = canEdit;

  // Named for what it exports: the cube hero's own Export button is on screen at the same time
  // and exports the cube's card list instead.
  const exportHref = `/cube/records/export/${record.cube}?record=${encodeURIComponent(record.id)}`;

  return (
    <CardBody>
      <Flexbox direction="col" gap="1">
        {/* Title and date on the left, actions on the right. Stacked on narrow viewports, which
            puts the actions directly under the date rather than squeezing them beside a
            wrapped title; side by side from md up, where they read as part of the title row
            rather than as a separate band of page chrome. The description sits below both, so
            it spans the full width at every size. */}
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
          <Flexbox direction="col" gap="3">
            <Flexbox direction="col" gap="1">
              <Text xl semibold>
                {record.name}
              </Text>
              <Text md className="text-text-secondary">
                <FormatttedDate date={record.date} />
              </Text>
            </Flexbox>
            {/* The event's stages, directly under the name of the event they belong to. Seating
                comes first and is what an organiser looks for before anything has happened, so
                it carries the weight and Collect Decks sits quieter beside it. */}
            <Flexbox direction="row" gap="2" wrap="wrap" alignItems="center">
              <RecordPlayersAction record={record} draft={draft} />
              {isOwner && (
                <CollectDecksButton color="secondary" modalprops={{ record }}>
                  Collect Decks
                </CollectDecksButton>
              )}
            </Flexbox>
          </Flexbox>
          <Flexbox direction="row" gap="4" wrap="wrap" alignItems="center" className="shrink-0">
            {isOwner ? (
              <>
                <Link href={`/cube/records/enter/${record.id}`}>Edit Record</Link>
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
                    <Link className={menuLinkClass} href={exportHref} download>
                      Export Record
                    </Link>
                    {/* Last and behind the menu, so deleting a record is never one slip from
                        exporting it. Deleting was previously reachable only from the record
                        list, which meant leaving the record to get rid of it. */}
                    <DeleteRecordLink
                      className="!text-danger hover:!text-link-active hover:cursor-pointer font-medium"
                      modalprops={{ recordId: record.id, redirectTo: `/cube/records/${record.cube}` }}
                    >
                      Delete Record
                    </DeleteRecordLink>
                  </Flexbox>
                </Dropdown>
              </>
            ) : (
              /* An overflow menu promises there is more behind it. Exporting is a reader's only
                 record-level action, so a menu would be a lid over a single item. */
              <Link href={exportHref} download>
                Export Record
              </Link>
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
