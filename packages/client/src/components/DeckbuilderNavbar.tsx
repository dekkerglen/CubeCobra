import React, { useCallback, useContext, useMemo, useRef } from 'react';

import { PencilIcon, ToolsIcon, TrashIcon } from '@primer/octicons-react';
import { cardOracleId } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import Draft from '@utils/datatypes/Draft';
import { getCardDefaultRowColumn, setupPicks } from '@utils/draftutil';

import DisplayContext from 'contexts/DisplayContext';

import { CSRFContext } from '../contexts/CSRFContext';
import Button from './base/Button';
import Dropdown from './base/Dropdown';
import { Flexbox } from './base/Layout';
import Link from './base/Link';
import CSRFForm from './CSRFForm';
import BasicsModal from './modals/BasicsModal';
import DeckDeleteModal from './modals/DeckDeleteModal';
import withModal from './WithModal';

const DeleteDeckModalLink = withModal('a', DeckDeleteModal);
const BasicsModalLink = withModal('a', BasicsModal);

interface DeckbuilderNavbarProps {
  draft: Draft;
  cubeID: string;
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
  cubeID,
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
    <Flexbox direction="row" gap="2" justify="start" className="w-full mt-2 px-2 flex-wrap">
      {/* Wrench menu with utility actions */}
      <Dropdown
        trigger={
          <Button color="secondary" className="py-2">
            <ToolsIcon size={16} />
          </Button>
        }
        align="left"
        minWidth="14rem"
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
          >
            Add Basic Lands
          </BasicsModalLink>
          <Link
            onClick={() => autoBuildDeck()}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
          >
            Build for Me
          </Link>
          <Link
            onClick={toggleShowCustomImages}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
          >
            {showCustomImages ? 'Hide' : 'Show'} Custom Images
          </Link>
          <Link
            onClick={toggleShowDeckBuilderStatsPanel}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
          >
            {showDeckBuilderStatsPanel ? 'Hide' : 'Show'} Deck Stats
          </Link>
        </Flexbox>
      </Dropdown>

      {/* Center section with Save and Delete */}
      <Flexbox direction="row" gap="2" justify="center" className="flex-1 flex-wrap">
        <div className="inline-block">
          <CSRFForm ref={formRef} method="POST" action={`/cube/deck/editdeck/${draft.id}`} formData={formData}>
            <Link href="#" onClick={() => formRef.current?.submit()} className="inline-block">
              <Button color="primary" className="py-2">
                <PencilIcon size={16} /> Save Deck
              </Button>
            </Link>
          </CSRFForm>
        </div>

        <DeleteDeckModalLink modalprops={{ deck: draft, cubeID }} className="inline-block">
          <Button color="danger" className="py-2">
            <TrashIcon size={16} /> Delete Deck
          </Button>
        </DeleteDeckModalLink>
      </Flexbox>
    </Flexbox>
  );
};

export default DeckbuilderNavbar;
