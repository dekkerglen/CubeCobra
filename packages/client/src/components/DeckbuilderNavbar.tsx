import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';

import { EyeIcon, FileMediaIcon, PencilIcon, PlusIcon, TagIcon, ZapIcon } from '@primer/octicons-react';
import { cardOracleId } from '@utils/cardutil';
import Card, { CardDetails } from '@utils/datatypes/Card';
import Draft from '@utils/datatypes/Draft';
import { DeckSortKey, getCardDefaultRowColumn, setupPicks } from '@utils/draftutil';

import DisplayContext from 'contexts/DisplayContext';
import { trackEvent } from 'utils/analytics';
import { cardNameMatches } from 'utils/cardAutocomplete';
import { getCard } from 'utils/cards/getCard';

import { CSRFContext } from '../contexts/CSRFContext';
import AutocompleteInput from './base/AutocompleteInput';
import Button from './base/Button';
import Dropdown from './base/Dropdown';
import { Flexbox } from './base/Layout';
import Link from './base/Link';
import Spinner from './base/Spinner';
import CSRFForm from './CSRFForm';
import DeckSortControls from './DeckSortControls';
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
  maxSpells?: number;
  maxLands?: number;
  // Adds an arbitrary card to the deck (resolved to a CardDetails). When set,
  // the Add Card control is shown.
  onAddCard?: (details: CardDetails) => void;
  // Default printing to resolve added cards to (the cube's preferred version).
  defaultPrinting?: string;
  // Number of cards in the original pool; anything beyond is submitted as new.
  originalCardCount?: number;
  // Re-sorts the deck/sideboard columns by the given attribute.
  onSort?: (key: DeckSortKey) => void;
  // Splits the deck/sideboard into creature and non-creature rows.
  onSplitCreatures?: () => void;
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
  maxSpells = 23,
  maxLands = 17,
  onAddCard,
  defaultPrinting,
  originalCardCount,
  onSort,
  onSplitCreatures,
}) => {
  const { csrfFetch } = useContext(CSRFContext);
  const { showCustomImages, toggleShowCustomImages, showDeckBuilderStatsPanel, toggleShowDeckBuilderStatsPanel } =
    useContext(DisplayContext);
  const formRef = useRef<HTMLFormElement>(null);
  // Tracks whether the user ran autobuild before saving, so the deck_build
  // event can attribute the save to 'autobuild' vs 'manual'.
  const autobuildUsedRef = useRef(false);
  const [displayDropdownOpen, setDisplayDropdownOpen] = React.useState(false);
  const [autobuilding, setAutobuilding] = useState(false);
  const [autobuildProgress, setAutobuildProgress] = useState<{ step: number; totalSteps: number } | null>(null);
  const [autobuildError, setAutobuildError] = useState<string | null>(null);
  const seatData = draft.seats[seat];
  const [deckTitle, setDeckTitle] = useState(seatData?.title || '');
  const [addCardValue, setAddCardValue] = useState('');
  const addCardRef = useRef<HTMLInputElement>(null);
  const formData = useMemo<Record<string, string>>(
    () => ({
      main: JSON.stringify(mainboard),
      side: JSON.stringify(sideboard),
      seat: seat.toString(),
      title: deckTitle,
      // Cards added beyond the original pool are appended server-side so the
      // mainboard/sideboard indices that reference them resolve correctly.
      newCards: JSON.stringify(cards.slice(originalCardCount ?? cards.length).map((card) => ({ cardID: card.cardID }))),
    }),
    [mainboard, sideboard, seat, deckTitle, cards, originalCardCount],
  );

  const handleAddCard = useCallback(
    async (name: string) => {
      const trimmed = (name || '').trim();
      if (!trimmed || !onAddCard) {
        return;
      }
      const details = await getCard(csrfFetch, defaultPrinting || '', trimmed);
      if (details) {
        onAddCard(details);
        setAddCardValue('');
        addCardRef.current?.focus();
      }
    },
    [csrfFetch, defaultPrinting, onAddCard],
  );

  const autoBuildDeck = useCallback(async () => {
    setAutobuilding(true);
    setAutobuildError(null);
    setAutobuildProgress(null);

    try {
      // Phase 1: start the deckbuild session. The server runs a single ML
      // build call, seeds the first 10 cards, and returns a session ID.
      const startResponse = await csrfFetch('/cube/api/deckbuild/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pool: [...mainboard.flat(3), ...sideboard.flat(3)].map((index) => cards[index].details),
          basics: basics.map((index) => cards[index].details),
          maxSpells,
          maxLands,
        }),
      });

      if (!startResponse.ok) {
        throw new Error(`Autobuild start failed: ${startResponse.status}`);
      }

      let result = await startResponse.json();
      if (!result?.success) {
        throw new Error(result?.message || 'Autobuild start failed');
      }

      setAutobuildProgress({ step: result.step, totalSteps: result.totalSteps });

      // Phase 2: walk the session forward one pick per HTTP call until the
      // server reports complete. Each step is one ML call, so latency is
      // capped per request and the progress bar reflects actual work done.
      while (!result.complete) {
        const stepResponse = await csrfFetch('/cube/api/deckbuild/step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: result.sessionId }),
        });

        if (!stepResponse.ok) {
          throw new Error(`Autobuild step failed: ${stepResponse.status}`);
        }

        const next = await stepResponse.json();
        if (!next?.success) {
          throw new Error(next?.message || 'Autobuild step failed');
        }

        // Preserve sessionId across iterations — /step doesn't echo it back.
        result = { ...next, sessionId: result.sessionId };
        setAutobuildProgress({ step: result.step, totalSteps: result.totalSteps });
      }

      // Result contains { mainboard, sideboard } as oracle IDs.
      const pool = [...mainboard.flat(3), ...sideboard.flat(3)];
      const newMainboard: number[] = [];

      for (const oracle of result.mainboard as string[]) {
        const poolIndex = pool.findIndex((cardindex) => cardOracleId(cards[cardindex]) === oracle);
        if (poolIndex === -1) {
          // Server filled remaining slots with basics, which live in the
          // separate `basics` array rather than the pool.
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

      // Format mainboard / sideboard into the row/col grid the UI expects.
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
      autobuildUsedRef.current = true;
    } catch (err) {
      console.error('Autobuild failed:', err);
      setAutobuildError(err instanceof Error ? err.message : 'Autobuild failed');
    } finally {
      setAutobuilding(false);
      setAutobuildProgress(null);
    }
  }, [csrfFetch, mainboard, sideboard, basics, cards, setDeck, setSideboard, maxLands, maxSpells]);

  const autobuildPercent =
    autobuildProgress && autobuildProgress.totalSteps > 0
      ? Math.min(100, Math.round((autobuildProgress.step / autobuildProgress.totalSteps) * 100))
      : 0;

  return (
    <Flexbox direction="row" gap="2" justify="start" alignItems="center" className="w-full mt-2 px-2" wrap="wrap">
      <BasicsModalLink
        href="#"
        modalprops={{
          basics: basics,
          addBasics,
          deck: mainboard.flat(2),
          cards: cards,
        }}
        className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
      >
        <FileMediaIcon size={16} />
        Add Basics
      </BasicsModalLink>
      {onAddCard && (
        <Flexbox direction="row" gap="1" alignItems="center" className="px-2">
          <PlusIcon size={16} className="text-text-secondary" />
          <AutocompleteInput
            cubeId={cubeID}
            getMatches={cardNameMatches(false, true)}
            type="text"
            innerRef={addCardRef}
            name="add-card"
            value={addCardValue}
            setValue={setAddCardValue}
            onSubmit={(e, val) => {
              e.preventDefault();
              handleAddCard(val ?? addCardValue);
            }}
            placeholder="Add card (e.g. Mox Ruby, or Mox Ruby [vma-263])"
            autoComplete="off"
            data-lpignore
            className="w-56"
          />
          <Button color="primary" disabled={addCardValue.length === 0} onClick={() => handleAddCard(addCardValue)}>
            <span className="text-nowrap">Add</span>
          </Button>
        </Flexbox>
      )}
      {onSort && onSplitCreatures && <DeckSortControls onSort={onSort} onSplitCreatures={onSplitCreatures} />}
      {autobuilding ? (
        <Flexbox direction="row" gap="2" alignItems="center" className="px-2 min-w-[12rem]">
          <Spinner sm />
          <div className="flex-1 min-w-[8rem]">
            <div className="w-full bg-bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-bg-active h-full rounded-full transition-all duration-200"
                style={{ width: `${autobuildPercent}%` }}
              />
            </div>
            <span className="text-xs text-text-secondary">
              {autobuildProgress
                ? `Autobuilding ${autobuildPercent}% (step ${autobuildProgress.step} of ${autobuildProgress.totalSteps})`
                : 'Autobuilding...'}
            </span>
          </div>
        </Flexbox>
      ) : (
        <Link
          onClick={() => autoBuildDeck()}
          className="flex items-center gap-2 transition-colors font-medium px-2 !text-link hover:!text-link-active !cursor-pointer"
        >
          <ZapIcon size={16} />
          Autobuild
        </Link>
      )}
      {autobuildError && !autobuilding && (
        <span className="text-xs text-danger px-2" role="alert">
          {autobuildError}
        </span>
      )}
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
        <Flexbox direction="row" gap="2" alignItems="center">
          <TagIcon size={16} className="text-text-secondary" />
          <input
            type="text"
            value={deckTitle}
            onChange={(e) => setDeckTitle(e.target.value)}
            placeholder={seatData?.name || 'Deck name...'}
            maxLength={100}
            className="border border-border rounded px-2 py-1 text-sm w-48 bg-bg focus:outline-none focus:border-link"
          />
          <Link
            href="#"
            onClick={() => {
              trackEvent('deck_build', { method: autobuildUsedRef.current ? 'autobuild' : 'manual' });
              formRef.current?.submit();
            }}
            className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
          >
            <PencilIcon size={16} />
            Save Deck
          </Link>
        </Flexbox>
      </CSRFForm>
    </Flexbox>
  );
};

export default DeckbuilderNavbar;
