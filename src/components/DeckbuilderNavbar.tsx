import CustomImageToggler from 'components/CustomImageToggler';
import BasicsModal from 'components/modals/BasicsModal';
import DeckDeleteModal from 'components/modals/DeckDeleteModal';
import withModal from 'components/WithModal';
import Card from 'datatypes/Card';
import { setupPicks } from 'drafting/draftutil';
import React, { useCallback, useContext, useMemo, useRef } from 'react';
import { cardCmc, cardOracleId, cardType } from 'utils/Card';
import Controls from './base/Controls';
import { ChevronUpIcon, ThreeBarsIcon } from '@primer/octicons-react';
import { Flexbox } from './base/Layout';
import ResponsiveDiv from './base/ResponsiveDiv';
import useToggle from 'hooks/UseToggle';
import Link from './base/Link';
import Button from './base/Button';
import Collapse from './base/Collapse';
import CSRFForm from './CSRFForm';
import Draft from 'datatypes/Draft';
import { CSRFContext } from 'contexts/CSRFContext';

const DeleteDeckModalLink = withModal(Link, DeckDeleteModal);
const BasicsModalLink = withModal(Link, BasicsModal);

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
}) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [expanded, toggleExpanded] = useToggle(false);
  const formRef = useRef<HTMLFormElement>(null);
  const formData = useMemo<Record<string, string>>(
    () => ({
      main: JSON.stringify(mainboard),
      side: JSON.stringify(sideboard),
    }),
    [mainboard, sideboard],
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
        const row = cardType(card).toLowerCase().includes('creature') || cardType(card).includes('Basic') ? 0 : 1;
        const column = Math.max(0, Math.min(cardCmc(card), 7));

        formattedMainboard[row][column].push(index);
      }

      for (const index of pool) {
        if (!basics.includes(index)) {
          const card = cards[index];
          const column = Math.max(0, Math.min(cardCmc(card), 7));

          formattedSideboard[0][column].push(index);
        }
      }

      setDeck(formattedMainboard);
      setSideboard(formattedSideboard);
    } else {
      console.error(json);
    }
  }, [mainboard, sideboard, basics, cards, setDeck, setSideboard]);

  const controls = (
    <>
      <CSRFForm ref={formRef} method="POST" action={`/cube/deck/editdeck/${draft.id}`} formData={formData}>
        <Link href="#" onClick={() => formRef.current?.submit()}>
          Save Deck
        </Link>
      </CSRFForm>
      <DeleteDeckModalLink modalprops={{ deck: draft, cubeID }}>Delete Deck</DeleteDeckModalLink>
      <BasicsModalLink
        modalprops={{
          basics: basics,
          addBasics,
          deck: mainboard.flat(2),
          cards: cards,
        }}
      >
        Add Basic Lands
      </BasicsModalLink>
      <Link onClick={() => autoBuildDeck()}>Build for Me</Link>
      <CustomImageToggler />
    </>
  );

  return (
    <Controls>
      <ResponsiveDiv lg>
        <Flexbox direction="row" justify="start" gap="4" alignItems="center" className="w-full py-2 px-4">
          {controls}
        </Flexbox>
      </ResponsiveDiv>
      <ResponsiveDiv baseVisible lg>
        <Flexbox direction="row" justify="between" gap="4" alignItems="start" className="w-full py-2 px-4">
          <Collapse isOpen={expanded}>
            <Flexbox direction="col" gap="2">
              {controls}
            </Flexbox>
          </Collapse>
          <Button color="secondary" onClick={toggleExpanded}>
            {expanded ? <ChevronUpIcon size={32} /> : <ThreeBarsIcon size={32} />}
          </Button>
        </Flexbox>
      </ResponsiveDiv>
    </Controls>
  );
};

export default DeckbuilderNavbar;
