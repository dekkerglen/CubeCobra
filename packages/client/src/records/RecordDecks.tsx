import React, { useContext } from 'react';

import Draft from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';

import { CardBody } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import ShareRecordModal from 'components/modals/ShareRecordModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';

import RecordAllDecks from './RecordAllDecks';

const ShareRecordLink = withModal(Link, ShareRecordModal);

interface RecordDecksProps {
  record: Record;
  draft?: Draft;
  players: User[];
  // Every deck's "View deck" jumps to the Players tab with that player selected, so this
  // lives one level up (RecordPage) rather than being local state here.
  onSelectPlayer: (index: number) => void;
}

// Unlike the single-deck view (RecordPlayers), this one never shows a per-card custom-image
// toggle, so — unlike that tab — it needs no DisplayContextProvider of its own.
const RecordDecks: React.FC<RecordDecksProps> = ({ record, draft, players, onSelectPlayer }) => {
  const { canEdit } = useContext(CubeContext);

  return (
    <CardBody>
      <Flexbox direction="col" gap="3">
        {/* Collecting decks is what this tab is for, so the share link lives here rather than
            in the record header. Offered even with nothing uploaded: the contribute page lets
            someone add themselves, so it works before anyone has been added. */}
        {canEdit && (
          <Flexbox direction="row" gap="4" justify="end" wrap="wrap" alignItems="center">
            <ShareRecordLink modalprops={{ record }}>Collect Decks</ShareRecordLink>
          </Flexbox>
        )}
        {/* RecordAllDecks handles a record with no draft itself, listing each player as deckless
            with their own upload link — the same thing it shows for a draft nobody has filled in. */}
        <RecordAllDecks
          record={record}
          draft={draft}
          players={players}
          canEdit={canEdit}
          onSelectPlayer={onSelectPlayer}
        />
      </Flexbox>
    </CardBody>
  );
};

export default RecordDecks;
