import React, { useCallback, useContext, useMemo, useRef } from 'react';

import { EyeIcon, PencilIcon, ZapIcon } from '@primer/octicons-react';
import { cardOracleId } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import Draft from '@utils/datatypes/Draft';
import { getCardDefaultRowColumn, setupPicks } from '@utils/draftutil';

import DisplayContext from 'contexts/DisplayContext';

import { CSRFContext } from '../contexts/CSRFContext';
import Dropdown from './base/Dropdown';
import { Flexbox } from './base/Layout';
import Link from './base/Link';
import CSRFForm from './CSRFForm';
import BasicsModal from './modals/BasicsModal';
import withModal from './WithModal';

const BasicsModalLink = withModal('a', BasicsModal);

interface DeckbuilderNavbarProps {
  draft: Draft;
  cubeID?: string;
  cards: Card[];
  basics: number[];
  mainboard: number[][][];
  sideboard: number[][][];
  addBasics: (numBasics: number[]) => void;
  name?: string;
  description?: string;
  className?: string;
  setDeck: (deck: any) => void;
  setSideboard: (sideboard: any) => void;
  seat: number;
}

const DeckbuilderNavbar: React.FC<DeckbuilderNavbarProps> = ({
  cards,
  basics,
  draft,
  cubeID: _cubeID,
  mainboard,
  sideboard,
  addBasics,
  setSideboard,
  setDeck,
  seat,
}) => {
  const { csrfFetch } = useContext(CSRFContext);
  const { showCustomImages, toggleShowCustomImages, showDeckBuilderStatsPanel, toggleShowDeckBuilderStatsPanel } =
    useContext(DisplayContext);
  const formRef = useRef<HTMLFormElement>(null);
  const [buildDropdownOpen, setBuildDropdownOpen] = React.useState(false);
  const [displayDropdownOpen, setDisplayDropdownOpen] = React.useState(false);
  const formData = useMemo<Record<string, string>>(
    () => ({
      main: JSON.stringify(mainboard),
      side: JSON.stringify(sideboard),
      seat: seat.toString(),
    }),
    [mainboard, sideboard, seat],
  );

  const autoBuildDeck = useCallback(async () => {
    const response = await csrfFetch('/cube/api/deckbuild', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pool: [...mainboard.flat(3), ...sideboard.flat(3)].map((index) => cards[index].details),
        basics: basics.map((index) => cards[index].details),
      }),
    });

    const json = await response.json();

    if (json.success === 'true') {
      const pool = [...mainboard.flat(3), ...sideboard.flat(3)];
      const newMainboard = [];

      for (const oracle of json.mainboard) {
        const poolIndex = pool.findIndex((cardindex) => cardOracleId(cards[cardindex]) === oracle);
        if (poolIndex === -1) {
          // try basics
          const basicsIndex = basics.findIndex((cardindex) => cardOracleId(cards[cardindex]) === oracle);
          if (basicsIndex !== -1) {
            newMainboard.push(basics[basicsIndex]);
          } else {
            console.error(`Could not find card ${oracle} in pool or basics`);
          }
        } else {
          newMainboard.push(pool[poolIndex]);
          pool.splice(poolIndex, 1);
        }
      }

      // format mainboard
      const formattedMainboard = setupPicks(2, 8);
      const formattedSideboard = setupPicks(1, 8);

      for (const index of newMainboard) {
        const card = cards[index];
        const { row, col } = getCardDefaultRowColumn(card);

        formattedMainboard[row][col].push(index);
      }

      for (const index of pool) {
        if (!basics.includes(index)) {
          const card = cards[index];
          const { col } = getCardDefaultRowColumn(card);

          formattedSideboard[0][col].push(index);
        }
      }

      setDeck(formattedMainboard);
      setSideboard(formattedSideboard);
    } else {
      console.error(json);
    }
  }, [csrfFetch, mainboard, sideboard, basics, cards, setDeck, setSideboard]);

  return (
    <Flexbox direction="row" gap="2" justify="start" alignItems="center" className="w-full mt-2 px-2" wrap="wrap">
      <Dropdown
        trigger={
          <Link className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2">
            <ZapIcon size={16} />
            Build
          </Link>
        }
        align="left"
        minWidth="16rem"
        isOpen={buildDropdownOpen}
        setIsOpen={setBuildDropdownOpen}
      >
        <Flexbox direction="col" gap="2" className="p-3">
          <BasicsModalLink
            href="#"
            modalprops={{
              basics: basics,
              addBasics,
              deck: mainboard.flat(2),
              cards: cards,
            }}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
            onClick={() => setBuildDropdownOpen(false)}
          >
            Add Basic Lands
          </BasicsModalLink>
          <Link
            onClick={() => {
              autoBuildDeck();
              setBuildDropdownOpen(false);
            }}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
          >
            Build for Me
          </Link>
        </Flexbox>
      </Dropdown>
      <Dropdown
        trigger={
          <Link className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2">
            <EyeIcon size={16} />
            Display
          </Link>
        }
        align="left"
        minWidth="16rem"
        isOpen={displayDropdownOpen}
        setIsOpen={setDisplayDropdownOpen}
      >
        <Flexbox direction="col" gap="2" className="p-3">
          <Link
            onClick={() => {
              toggleShowCustomImages();
              setDisplayDropdownOpen(false);
            }}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
          >
            {showCustomImages ? 'Hide' : 'Show'} Custom Images
          </Link>
          <Link
            onClick={() => {
              toggleShowDeckBuilderStatsPanel();
              setDisplayDropdownOpen(false);
            }}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
          >
            {showDeckBuilderStatsPanel ? 'Hide' : 'Show'} Deck Stats
          </Link>
        </Flexbox>
      </Dropdown>
      <CSRFForm ref={formRef} method="POST" action={`/cube/deck/editdeck/${draft.id}`} formData={formData}>
        <Link
          href="#"
          onClick={() => formRef.current?.submit()}
          className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
        >
          <PencilIcon size={16} />
          Save Deck
        </Link>
      </CSRFForm>
    </Flexbox>
  );
};

export default DeckbuilderNavbar;
