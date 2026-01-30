import React, { useCallback } from 'react';

import { CopyIcon, EyeClosedIcon, EyeIcon, PencilIcon, SyncIcon, UploadIcon } from '@primer/octicons-react';
import { cardName } from '@utils/cardutil';
import Draft from '@utils/datatypes/Draft';
import User from '@utils/datatypes/User';

import Button from 'components/base/Button';
import Dropdown from 'components/base/Dropdown';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Select from 'components/base/Select';
import SampleHandModal from 'components/modals/SampleHandModal';
import withModal from 'components/WithModal';
import DisplayContext from 'contexts/DisplayContext';
import useAlerts, { Alerts } from 'hooks/UseAlerts';

const SampleHandModalLink = withModal('a', SampleHandModal);

interface CubeDeckNavbarProps {
  draft: Draft;
  user: User | null;
  seatIndex: string;
  setSeatIndex: (value: string) => void;
  view: string;
  setView: (value: string) => void;
}

const CubeDeckNavbar: React.FC<CubeDeckNavbarProps> = ({ draft, user, seatIndex, setSeatIndex, view, setView }) => {
  const [exportDropdownOpen, setExportDropdownOpen] = React.useState(false);
  const [editDropdownOpen, setEditDropdownOpen] = React.useState(false);
  const { showCustomImages, toggleShowCustomImages } = React.useContext(DisplayContext);
  const { alerts, addAlert, dismissAlerts } = useAlerts();

  const isOwner = user && draft.owner && user.id === (draft.owner as User).id;
  const hasMultipleSeats = draft.seats.length > 1;

  const copyToClipboard = useCallback(async () => {
    const cards = draft.cards;
    const mainboard = draft.seats[parseInt(seatIndex || '0')].mainboard;

    const cardNames = [];
    for (const row of mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const name = cardName(cards[cardIndex]);
          if (name) {
            cardNames.push(name);
          }
        }
      }
    }

    await navigator.clipboard.writeText(cardNames.join('\n'));
    addAlert('success', 'Copied.');
    setTimeout(dismissAlerts, 3000);
  }, [addAlert, dismissAlerts, draft, seatIndex]);

  return (
    <Flexbox direction="row" gap="6" alignItems="center" justify="start" className="px-2 mt-2" wrap="wrap">
      <SampleHandModalLink
        modalprops={{
          deck: draft.seats[parseInt(seatIndex || '0')].mainboard
            ?.flat(3)
            .map((cardIndex) => draft.cards[cardIndex]),
        }}
        className="flex items-center gap-2 !text-button-primary hover:!text-button-primary-active transition-colors font-medium cursor-pointer"
      >
        <CopyIcon size={16} />
        Sample Hand
      </SampleHandModalLink>
      <Link
        href={`/cube/deck/rebuild/${draft.id}/${seatIndex}`}
        className="flex items-center gap-2 !text-button-primary hover:!text-button-primary-active transition-colors font-medium cursor-pointer"
      >
        <SyncIcon size={16} />
        Clone and Rebuild
      </Link>
      <Link
        href="#"
        onClick={() => {
          toggleShowCustomImages();
        }}
        className="flex items-center gap-2 !text-button-primary hover:!text-button-primary-active transition-colors font-medium cursor-pointer"
      >
        {showCustomImages ? <EyeClosedIcon size={16} /> : <EyeIcon size={16} />}
        {showCustomImages ? 'Hide' : 'Show'} Custom Images
      </Link>
      <Flexbox direction="row" gap="2" alignItems="center" justify="center" className="flex-1" wrap="wrap">
        <div className="inline-block">
          <Select
            value={seatIndex}
            setValue={setSeatIndex}
            options={draft.seats.map((seat, index) => ({
              value: index.toString(),
              label: `Seat ${index + 1}: ${seat.name}`,
            }))}
            className="bg-button-secondary text-text"
          />
        </div>
        <div className="inline-block">
          <Select
            value={view}
            setValue={setView}
            options={[
              { value: 'draft', label: 'Deck View' },
              { value: 'visual', label: 'Visual Spoiler' },
              { value: 'picks', label: 'Pick by Pick Breakdown' },
            ]}
            className="bg-button-secondary text-text"
          />
        </div>
        <Dropdown
          trigger={
            <Button color="secondary" className="flex items-center gap-2">
              Export
              <UploadIcon size={16} />
            </Button>
          }
          align="left"
          minWidth="16rem"
          isOpen={exportDropdownOpen}
          setIsOpen={setExportDropdownOpen}
        >
          <Flexbox direction="col" gap="2" className="p-3">
            <Link
              href={`/cube/deck/download/txt/${draft.id}/${seatIndex}`}
              className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
              onClick={() => setExportDropdownOpen(false)}
            >
              Card Names (.txt)
            </Link>
            <Link
              href="#"
              onClick={() => {
                copyToClipboard();
                setExportDropdownOpen(false);
              }}
              className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
            >
              Card Names to Clipboard
            </Link>
            <Link
              href={`/cube/deck/download/forge/${draft.id}/${seatIndex}`}
              className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
              onClick={() => setExportDropdownOpen(false)}
            >
              Forge (.dck)
            </Link>
            <Link
              href={`/cube/deck/download/xmage/${draft.id}/${seatIndex}`}
              className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
              onClick={() => setExportDropdownOpen(false)}
            >
              XMage (.dck)
            </Link>
            <Link
              href={`/cube/deck/download/mtgo/${draft.id}/${seatIndex}`}
              className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
              onClick={() => setExportDropdownOpen(false)}
            >
              MTGO (.txt)
            </Link>
            <Link
              href={`/cube/deck/download/arena/${draft.id}/${seatIndex}`}
              className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
              onClick={() => setExportDropdownOpen(false)}
            >
              Arena (.txt)
            </Link>
            <Link
              href={`/cube/deck/download/cockatrice/${draft.id}/${seatIndex}`}
              className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
              onClick={() => setExportDropdownOpen(false)}
            >
              Cockatrice (.txt)
            </Link>
            <Link
              href={`/cube/deck/download/topdecked/${draft.id}/${seatIndex}`}
              className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
              onClick={() => setExportDropdownOpen(false)}
            >
              TopDecked (.csv)
            </Link>
            <Alerts alerts={alerts} />
          </Flexbox>
        </Dropdown>
        {isOwner && hasMultipleSeats && (
          <Dropdown
            trigger={
              <Button color="secondary" className="flex items-center gap-2">
                Edit
                <PencilIcon size={16} />
              </Button>
            }
            align="left"
            minWidth="16rem"
            isOpen={editDropdownOpen}
            setIsOpen={setEditDropdownOpen}
          >
            <Flexbox direction="col" gap="2" className="p-3">
              {draft.seats.map((seat, index) => (
                <Link
                  key={index}
                  href={`/draft/deckbuilder/${draft.id}?seat=${index}`}
                  className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
                  onClick={() => setEditDropdownOpen(false)}
                >
                  Seat {index + 1}: {seat.name}
                </Link>
              ))}
            </Flexbox>
          </Dropdown>
        )}
        {isOwner && !hasMultipleSeats && (
          <Button
            color="secondary"
            type="link"
            href={`/draft/deckbuilder/${draft.id}?seat=0`}
            className="flex items-center gap-2"
          >
            Edit
            <PencilIcon size={16} />
          </Button>
        )}
      </Flexbox>
    </Flexbox>
  );
};

export default CubeDeckNavbar;
