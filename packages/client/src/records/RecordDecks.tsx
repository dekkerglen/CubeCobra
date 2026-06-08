import React, { useContext } from 'react';

import { ChevronUpIcon, KebabHorizontalIcon, ThreeBarsIcon } from '@primer/octicons-react';
import Draft from '@utils/datatypes/Draft';
import Record, { formatRecord, playerRecord } from '@utils/datatypes/Record';

import Button from 'components/base/Button';
import { CardBody } from 'components/base/Card';
import Collapse from 'components/base/Collapse';
import Dropdown from 'components/base/Dropdown';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import DeckCard from 'components/DeckCard';
import DraftExportMenu from 'components/draft/DraftExportMenu';
import RecordOverrideModal from 'components/modals/RecordOverrideModal';
import RemoveDeckModal from 'components/modals/RemoveDeckModal';
import SampleHandModal from 'components/modals/SampleHandModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextProvider } from 'contexts/DisplayContext';
import UserContext from 'contexts/UserContext';
import useToggle from 'hooks/UseToggle';

interface RecordDecksProps {
  record: Record;
  draft?: Draft;
}

const SampleHandLink = withModal(Link, SampleHandModal);
const RemoveDeckLink = withModal(Link, RemoveDeckModal);
const RecordOverrideLink = withModal(Button, RecordOverrideModal);

const menuLinkClass = '!text-text hover:!text-link-active hover:cursor-pointer font-medium';

const firstPlayerIndexWithDeck = (record: Record, draft: Draft | undefined): number => {
  if (!draft) return -1;

  for (let i = 0; i < record.players.length; i++) {
    const seat = draft.seats[i];
    if (seat?.mainboard?.flat(3).length > 0) {
      return i;
    }
  }
  return -1;
};

const RecordDecksContent: React.FC<RecordDecksProps> = ({ record, draft }) => {
  const { cube } = useContext(CubeContext);
  const user = useContext(UserContext);
  const { showCustomImages, toggleShowCustomImages } = useContext(DisplayContext);
  // Default to the first player who actually has a deck; fall back to player 0
  // so the controls (quick record, etc.) still target a valid player.
  const firstWithDeck = firstPlayerIndexWithDeck(record, draft);
  const [selectedUserIndex, setSelectedUserIndex] = React.useState<number>(firstWithDeck >= 0 ? firstWithDeck : 0);
  const [expanded, toggleExpanded] = useToggle(false);

  const isOwner = user && cube && user.id === cube.owner.id;
  const selectedPlayer = record.players[selectedUserIndex];

  if (record.players.length === 0) {
    return (
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text sm>{'No players have been added to this record yet.'}</Text>
        </Flexbox>
      </CardBody>
    );
  }

  // A player's current record (override or match-derived, default 0-0). Owners
  // can click to set it; others see it read-only.
  const recordControl =
    selectedPlayer &&
    (isOwner ? (
      <RecordOverrideLink color="secondary" modalprops={{ record, playerName: selectedPlayer.name }}>
        {`Record: ${formatRecord(playerRecord(record, selectedPlayer.name))}`}
      </RecordOverrideLink>
    ) : (
      <Text sm>{`Record: ${formatRecord(playerRecord(record, selectedPlayer.name))}`}</Text>
    ));

  if (!draft) {
    return (
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text sm>{'No draft data available for this record.'}</Text>
          {isOwner && (
            <Select
              value={`${selectedUserIndex}`}
              setValue={(value) => setSelectedUserIndex(parseInt(value, 10))}
              dense
              label="Player"
              options={record.players.map((player, index) => ({ value: `${index}`, label: player.name }))}
            />
          )}
          {recordControl}
          {isOwner && <Link href={`/cube/records/uploaddeck/${record.id}`}>Upload a deck to this record</Link>}
        </Flexbox>
      </CardBody>
    );
  }

  const selectedSeat = draft.seats[selectedUserIndex];
  const selectedHasDeck = (selectedSeat?.mainboard?.flat(3).length ?? 0) > 0;

  const controls = (
    <>
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
            modalprops={{ deck: selectedSeat?.mainboard?.flat(3).map((cardIndex) => draft.cards[cardIndex]) }}
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
          {isOwner && selectedHasDeck && selectedPlayer && (
            <RemoveDeckLink
              className="!text-danger hover:!text-link-active hover:cursor-pointer font-medium"
              modalprops={{ record, seatIndex: selectedUserIndex, playerName: selectedPlayer.name }}
            >
              Remove Deck
            </RemoveDeckLink>
          )}
        </Flexbox>
      </Dropdown>
    </>
  );

  return (
    <CardBody>
      <Flexbox direction="col" gap="2">
        <Flexbox direction="row" justify="between" alignItems="end" className="py-2 px-4">
          <Flexbox direction="row" justify="start" gap="4" alignItems="end">
            <Select
              value={`${selectedUserIndex}`}
              setValue={(value) => {
                const index = parseInt(value, 10);
                setSelectedUserIndex(index);
              }}
              dense={true}
              label="View deck for player"
              options={record.players
                .map((player, index) => ({
                  value: `${index}`,
                  label: player.name,
                }))
                .filter((option) => draft.seats[parseInt(option.value, 10)]?.mainboard?.flat(3).length > 0)}
            />
            {recordControl}
            {isOwner && <Link href={`/cube/records/uploaddeck/${record.id}`}>Upload another deck to this record</Link>}
          </Flexbox>
          <ResponsiveDiv baseVisible lg>
            <Button color="secondary" onClick={toggleExpanded}>
              {expanded ? <ChevronUpIcon size={32} /> : <ThreeBarsIcon size={32} />}
            </Button>
          </ResponsiveDiv>
          <ResponsiveDiv lg>
            <Flexbox direction="row" justify="start" gap="4" alignItems="center">
              {controls}
            </Flexbox>
          </ResponsiveDiv>
        </Flexbox>
        <ResponsiveDiv baseVisible lg>
          <Collapse isOpen={expanded}>
            <Flexbox direction="col" gap="2" className="py-2 px-4">
              {controls}
            </Flexbox>
          </Collapse>
        </ResponsiveDiv>
        <DeckCard
          seat={draft.seats[selectedUserIndex]}
          draft={draft}
          view="draft"
          seatIndex={`${selectedUserIndex}`}
          hideComments
        />
      </Flexbox>
    </CardBody>
  );
};

const RecordDecks: React.FC<RecordDecksProps> = ({ record, draft }) => {
  const { cube } = useContext(CubeContext);

  return (
    <DisplayContextProvider cubeID={cube?.id || ''}>
      <RecordDecksContent record={record} draft={draft} />
    </DisplayContextProvider>
  );
};

export default RecordDecks;
