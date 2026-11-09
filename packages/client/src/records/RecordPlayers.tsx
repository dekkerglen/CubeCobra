import React, { useContext, useState } from 'react';

import { KebabHorizontalIcon } from '@primer/octicons-react';
import { getCubeDisplayOptions } from '@utils/datatypes/Cube';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import Record, { formatRecord, PlayerList, playerRecord } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';
import classNames from 'classnames';

import Button from 'components/base/Button';
import { CardBody } from 'components/base/Card';
import Dropdown from 'components/base/Dropdown';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import PostButton from 'components/base/PostButton';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import DeckCard from 'components/DeckCard';
import DraftExportMenu from 'components/draft/DraftExportMenu';
import LoadingButton from 'components/LoadingButton';
import RemoveDeckModal from 'components/modals/RemoveDeckModal';
import SampleHandModal from 'components/modals/SampleHandModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextProvider } from 'contexts/DisplayContext';

import EditPlayerList from './EditPlayerList';
import SetTheTable from './SetTheTable';

interface RecordPlayersProps {
  record: Record;
  draft?: Draft;
  players: User[];
  // Lifted to RecordPage so the Decks tab's "View deck" can hand it over across tabs.
  selectedPlayer: number;
  setSelectedPlayer: (index: number) => void;
}

const SampleHandLink = withModal(Link, SampleHandModal);
const RemoveDeckLink = withModal(Link, RemoveDeckModal);

const menuLinkClass = '!text-text hover:!text-link-active hover:cursor-pointer font-medium';

export const seatHasDeck = (draft: Draft | undefined, index: number): boolean =>
  (draft?.seats[index]?.mainboard?.flat(3).length ?? 0) > 0;

// Exported so RecordPage can pick a sensible initial selection without duplicating the rule
// here: default to the first player who actually has a deck, falling back to player 0.
export const firstPlayerIndexWithDeck = (record: Record, draft: Draft | undefined): number => {
  if (!draft) return -1;
  for (let i = 0; i < record.players.length; i++) {
    if (seatHasDeck(draft, i)) return i;
  }
  return -1;
};

interface AddPlayersModalProps {
  record: Record;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

// Several names go in, one commit comes out: the live-event opening is a queue of people in
// front of the organiser, and a save-per-name would mean a page reload at the exact moment
// that is most disruptive. Seeded empty (not with the record's existing roster) so the
// rename/reorder/remove controls EditPlayerList brings along only ever touch names staged in
// this session — the existing roster is never loaded into this editor, so it can't be
// reordered from here. That's the gap that sank the modal this replaces: it loaded the full
// roster and a played draft then rejected the whole save once a reorder came back with it.
const AddPlayersModal: React.FC<AddPlayersModalProps> = ({ record, isOpen, setOpen }) => {
  const [staged, setStaged] = useState<PlayerList>([]);
  const formRef = React.createRef<HTMLFormElement>();

  const players = [...record.players, ...staged];
  // Identity for every seat already there, -1 for each one just staged. Getting this wrong
  // re-seats an existing deck onto whichever player now shares its index.
  const seatOrder = [...record.players.map((_, index) => index), ...staged.map(() => -1)];

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} xl>
      <ModalHeader setOpen={setOpen}>{`Add players to ${record.name}`}</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <EditPlayerList players={[]} setPlayers={setStaged} />
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block disabled={staged.length === 0}>
          Save Players
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/players/${record.id}`}
          formData={{
            players: JSON.stringify(players),
            seatOrder: JSON.stringify(seatOrder),
            // The roster seatOrder's positions refer to, so a change made elsewhere since is caught.
            expectedPlayers: JSON.stringify(record.players.map((player) => player.name)),
          }}
          ref={formRef}
        ></CSRFForm>
      </ModalFooter>
    </Modal>
  );
};

const AddPlayersButton = withModal(Button, AddPlayersModal);

const SeatingModal: React.FC<AddPlayersModalProps> = ({ record, isOpen, setOpen }) => (
  <Modal isOpen={isOpen} setOpen={setOpen} xl>
    <ModalHeader setOpen={setOpen}>Seating</ModalHeader>
    <ModalBody>
      <SetTheTable record={record} />
    </ModalBody>
  </Modal>
);

// Reads as a link beside the record's other actions, but is a button: it opens a dialog rather
// than going anywhere, and has to be reachable from the keyboard.
// withModal hands its own props on to what it wraps; they're kept off the DOM element.
type TextButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  modalprops?: unknown;
  altClick?: unknown;
  stopPropagation?: unknown;
};
const TextButton: React.FC<TextButtonProps> = ({
  className,
  modalprops: _modalprops,
  altClick: _altClick,
  stopPropagation: _stopPropagation,
  ...props
}) => (
  <button type="button" className={classNames('font-medium text-link hover:text-link-active', className)} {...props} />
);

const SeatingAction = withModal(TextButton, SeatingModal);
const AddPlayersAction = withModal(TextButton, AddPlayersModal);

// The whole table can be rearranged only while no played draft is tied to it: a played
// draft's seats are fixed by who actually sat where, so its record can only be added to.
export const canRearrangeSeats = (draft: Draft | undefined): boolean => !draft || draft.type === DRAFT_TYPES.UPLOAD;

/**
 * The record header's player action, for its owner: Seating, or Add Players when a played
 * draft fixes the seats. Absent while the record has no players, since the Players tab then
 * shows the table (or its own Add Players) in place of the roster.
 */
export const RecordPlayersAction: React.FC<{ record: Record; draft?: Draft }> = ({ record, draft }) => {
  const { canEdit } = useContext(CubeContext);
  if (!canEdit || record.players.length === 0) {
    return null;
  }
  return canRearrangeSeats(draft) ? (
    <SeatingAction modalprops={{ record }}>Seating</SeatingAction>
  ) : (
    <AddPlayersAction modalprops={{ record }}>Add Players</AddPlayersAction>
  );
};

const RecordPlayersContent: React.FC<RecordPlayersProps> = ({
  record,
  draft,
  players,
  selectedPlayer,
  setSelectedPlayer,
}) => {
  const { canEdit } = useContext(CubeContext);
  const { showCustomImages, toggleShowCustomImages } = useContext(DisplayContext);
  const isOwner = canEdit;
  const selectedUserIndex = selectedPlayer;
  // The deck upload page, pre-selecting whichever player is showing. Offered only from the
  // no-deck placeholder: a player who already has a deck has nothing to upload, and the
  // endpoint refuses a second one — so an always-visible link beside the roster was a dead
  // end for exactly the players it was most prominent for.
  const uploadDeckHref = `/cube/records/uploaddeck/${record.id}?player=${selectedUserIndex + 1}`;
  const selectedPlayerEntry = record.players[selectedUserIndex];
  const selectedHasDeck = seatHasDeck(draft, selectedUserIndex);
  const uploadDeckLabel = selectedPlayerEntry ? `Upload a deck for ${selectedPlayerEntry.name}` : 'Upload a deck';

  const rearrangeable = canRearrangeSeats(draft);

  if (record.players.length === 0 && isOwner && rearrangeable) {
    return (
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text lg semibold>
            Seat the players
          </Text>
          <Text sm className="text-text-secondary">
            Fill the table chair by chair, or paste a list and seat everyone at once.
          </Text>
          <SetTheTable record={record} />
        </Flexbox>
      </CardBody>
    );
  }

  if (record.players.length === 0) {
    return (
      <CardBody>
        <Flexbox direction="col" gap="2" alignItems="start">
          <Text sm>No players have been added to this record yet.</Text>
          {isOwner && (
            <AddPlayersButton color="primary" modalprops={{ record }}>
              Add Players
            </AddPlayersButton>
          )}
        </Flexbox>
      </CardBody>
    );
  }

  // A player's current record (override or match-derived). The override control that used to
  // sit here moved into the transcription workspace, which can edit it alongside everything
  // else — this is read-only now regardless of ownership.
  const recordControl = selectedPlayerEntry && (
    <Text sm>{`Record: ${formatRecord(playerRecord(record, selectedPlayerEntry.name))}`}</Text>
  );

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
            <PostButton
              action={`/cube/deck/rebuild/${draft.id}/${selectedUserIndex}`}
              unstyled
              className={classNames(menuLinkClass, 'w-full text-left')}
            >
              Clone and Rebuild
            </PostButton>
          )}
          <Link href="#" onClick={toggleShowCustomImages} className={menuLinkClass}>
            {showCustomImages ? 'Hide' : 'Show'} Custom Images
          </Link>
          {isOwner && selectedPlayerEntry && (
            <RemoveDeckLink
              className="!text-danger hover:!text-link-active hover:cursor-pointer font-medium"
              modalprops={{ record, seatIndex: selectedUserIndex, playerName: selectedPlayerEntry.name }}
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
          <Text semibold>Players</Text>
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
                  onClick={() => setSelectedPlayer(index)}
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
        </Flexbox>

        {/* Selected player's deck (or an empty state). */}
        <Flexbox direction="col" gap="2" className="flex-1 min-w-0">
          {selectedPlayerEntry && (
            <Flexbox direction="row" gap="3" wrap="wrap" alignItems="center">
              <Text lg semibold>
                {selectedPlayerEntry.name}
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
              {isOwner && <Link href={uploadDeckHref}>{uploadDeckLabel}</Link>}
            </Flexbox>
          )}
        </Flexbox>
      </Flexbox>
    </CardBody>
  );
};

const RecordPlayers: React.FC<RecordPlayersProps> = (props) => {
  const { cube } = useContext(CubeContext);

  return (
    <DisplayContextProvider cubeID={cube?.id || ''} savedDisplayOptions={getCubeDisplayOptions(cube)}>
      <RecordPlayersContent {...props} />
    </DisplayContextProvider>
  );
};

export default RecordPlayers;
