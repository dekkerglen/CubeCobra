import React, { useContext } from 'react';

import { KebabHorizontalIcon } from '@primer/octicons-react';
import Draft from '@utils/datatypes/Draft';
import Record, { formatRecord, playerRecord } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';
import classNames from 'classnames';

import Button from 'components/base/Button';
import { CardBody } from 'components/base/Card';
import Dropdown from 'components/base/Dropdown';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import DeckCard from 'components/DeckCard';
import DraftExportMenu from 'components/draft/DraftExportMenu';
import EditPlayerListModal from 'components/modals/EditPlayerListModal';
import RecordOverrideModal from 'components/modals/RecordOverrideModal';
import RemoveDeckModal from 'components/modals/RemoveDeckModal';
import SampleHandModal from 'components/modals/SampleHandModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextProvider } from 'contexts/DisplayContext';
import UserContext from 'contexts/UserContext';

interface RecordDecksProps {
  record: Record;
  draft?: Draft;
  players: User[];
}

const SampleHandLink = withModal(Link, SampleHandModal);
const RemoveDeckLink = withModal(Link, RemoveDeckModal);
const RecordOverrideLink = withModal(Button, RecordOverrideModal);
const EditPlayerListLink = withModal(Link, EditPlayerListModal);

const menuLinkClass = '!text-text hover:!text-link-active hover:cursor-pointer font-medium';

const seatHasDeck = (draft: Draft | undefined, index: number): boolean =>
  (draft?.seats[index]?.mainboard?.flat(3).length ?? 0) > 0;

const firstPlayerIndexWithDeck = (record: Record, draft: Draft | undefined): number => {
  if (!draft) return -1;
  for (let i = 0; i < record.players.length; i++) {
    if (seatHasDeck(draft, i)) return i;
  }
  return -1;
};

const RecordDecksContent: React.FC<RecordDecksProps> = ({ record, draft, players }) => {
  const { cube } = useContext(CubeContext);
  const user = useContext(UserContext);
  const { showCustomImages, toggleShowCustomImages } = useContext(DisplayContext);
  // Default to the first player who actually has a deck; fall back to player 0.
  const firstWithDeck = firstPlayerIndexWithDeck(record, draft);
  const [selectedUserIndex, setSelectedUserIndex] = React.useState<number>(firstWithDeck >= 0 ? firstWithDeck : 0);

  const isOwner = !!(user && cube && user.id === cube.owner.id);
  const selectedPlayer = record.players[selectedUserIndex];
  const selectedHasDeck = seatHasDeck(draft, selectedUserIndex);

  if (record.players.length === 0) {
    return (
      <CardBody>
        <Flexbox direction="col" gap="2" alignItems="start">
          <Text sm>No players have been added to this record yet.</Text>
          {isOwner && (
            <Flexbox direction="row" gap="4" wrap="wrap" alignItems="center">
              <EditPlayerListLink modalprops={{ record }}>Add players</EditPlayerListLink>
              <Link href={`/cube/records/uploaddeck/${record.id}`}>Upload a deck</Link>
            </Flexbox>
          )}
        </Flexbox>
      </CardBody>
    );
  }

  // A player's current record (override or match-derived). Owners can click to set it.
  const recordControl =
    selectedPlayer &&
    (isOwner ? (
      <RecordOverrideLink color="secondary" modalprops={{ record, playerName: selectedPlayer.name }}>
        {`Record: ${formatRecord(playerRecord(record, selectedPlayer.name))}`}
      </RecordOverrideLink>
    ) : (
      <Text sm>{`Record: ${formatRecord(playerRecord(record, selectedPlayer.name))}`}</Text>
    ));

  const deckControls = draft && selectedHasDeck && (
    <Flexbox direction="row" gap="4" wrap="wrap" alignItems="center">
      {isOwner && <Link href={`/draft/deckbuilder/${draft.id}?seat=${selectedUserIndex}`}>Edit Deck</Link>}
      <DraftExportMenu draft={draft} seatIndex={`${selectedUserIndex}`} />
      <Dropdown
        trigger={
          <Link className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2">
            <KebabHorizontalIcon size={16} />
            More
          </Link>
        }
        align="left"
        minWidth="16rem"
      >
        <Flexbox direction="col" gap="2" className="p-3">
          <SampleHandLink
            className={menuLinkClass}
            modalprops={{
              deck: draft.seats[selectedUserIndex]?.mainboard?.flat(3).map((cardIndex) => draft.cards[cardIndex]),
            }}
          >
            Sample Hand
          </SampleHandLink>
          {isOwner && (
            <Link href={`/cube/deck/rebuild/${draft.id}/${selectedUserIndex}`} className={menuLinkClass}>
              Clone and Rebuild
            </Link>
          )}
          <Link href="#" onClick={toggleShowCustomImages} className={menuLinkClass}>
            {showCustomImages ? 'Hide' : 'Show'} Custom Images
          </Link>
          {isOwner && selectedPlayer && (
            <RemoveDeckLink
              className="!text-danger hover:!text-link-active hover:cursor-pointer font-medium"
              modalprops={{ record, seatIndex: selectedUserIndex, playerName: selectedPlayer.name }}
            >
              Remove Deck
            </RemoveDeckLink>
          )}
        </Flexbox>
      </Dropdown>
    </Flexbox>
  );

  return (
    <CardBody>
      <Flexbox direction="col" gap="4" className="md:flex-row md:items-start">
        {/* Player list — a vertical pill selector that controls which deck shows. */}
        <Flexbox direction="col" gap="2" className="md:w-60 md:shrink-0">
          <Flexbox direction="row" justify="between" alignItems="center">
            <Text semibold>Players</Text>
            {isOwner && <EditPlayerListLink modalprops={{ record }}>Edit</EditPlayerListLink>}
          </Flexbox>
          <Flexbox direction="col" gap="1">
            {record.players.map((player, index) => {
              const selected = index === selectedUserIndex;
              const hasDeck = seatHasDeck(draft, index);
              const linkedUser = players.find((u) => u.id === player.userId);
              const hasTrophy = record.trophy?.includes(player.name);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedUserIndex(index)}
                  title={hasDeck ? player.name : `${player.name} (no deck)`}
                  className={classNames(
                    'flex items-center gap-2 w-full text-left rounded-full border px-3 py-1.5 transition-colors',
                    selected ? 'border-link bg-bg-active' : 'border-border hover:bg-bg-active',
                    { 'opacity-60': !hasDeck },
                  )}
                >
                  {linkedUser?.image?.uri ? (
                    <img src={linkedUser.image.uri} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-bg-active border border-border shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-sm font-medium">
                    {hasTrophy ? '🏆 ' : ''}
                    {player.name}
                  </span>
                  <span className="shrink-0 text-xs text-text-secondary">
                    {formatRecord(playerRecord(record, player.name))}
                  </span>
                </button>
              );
            })}
          </Flexbox>
          {isOwner && (
            <Link href={`/cube/records/uploaddeck/${record.id}`}>
              <Text sm>Upload a deck</Text>
            </Link>
          )}
        </Flexbox>

        {/* Selected player's deck (or an empty state). */}
        <Flexbox direction="col" gap="2" className="flex-1 min-w-0">
          {selectedPlayer && (
            <Flexbox direction="row" gap="3" wrap="wrap" alignItems="center">
              <Text lg semibold>
                {selectedPlayer.name}
              </Text>
              {recordControl}
            </Flexbox>
          )}
          {draft && selectedHasDeck ? (
            <>
              {deckControls}
              <DeckCard
                seat={draft.seats[selectedUserIndex]}
                draft={draft}
                view="draft"
                seatIndex={`${selectedUserIndex}`}
                hideComments
              />
            </>
          ) : (
            <Flexbox direction="col" gap="2">
              <Text sm className="text-text-secondary">
                {draft ? 'No deck has been uploaded for this player yet.' : 'No draft data available for this record.'}
              </Text>
              {isOwner && <Link href={`/cube/records/uploaddeck/${record.id}`}>Upload a deck to this record</Link>}
            </Flexbox>
          )}
        </Flexbox>
      </Flexbox>
    </CardBody>
  );
};

const RecordDecks: React.FC<RecordDecksProps> = ({ record, draft, players }) => {
  const { cube } = useContext(CubeContext);

  return (
    <DisplayContextProvider cubeID={cube?.id || ''}>
      <RecordDecksContent record={record} draft={draft} players={players} />
    </DisplayContextProvider>
  );
};

export default RecordDecks;
