import React, { useCallback, useState } from 'react';

import { cardType, cmcColumn, detailsToCard } from '@utils/cardutil';
import CardType, { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import { DeckSortKey, getCardDefaultRowColumn, sortDeckIntoColumns, splitDeckByCreature } from '@utils/draftutil';

import BotDeckStatusBanner from 'components/BotDeckStatusBanner';
import DeckBuilderStatsPanel from 'components/DeckBuilderStatsPanel';

import Container from '../components/base/Container';
import DeckbuilderNavbar from '../components/DeckbuilderNavbar';
import DeckTable from '../components/draft/table/DeckTable';
import DynamicFlash from '../components/DynamicFlash';
import ErrorBoundary from '../components/ErrorBoundary';
import RenderToRoot from '../components/RenderToRoot';
import DraftLocation, { addCard, removeCard } from '../drafting/DraftLocation';
import { discardToPile, restoreFromPile } from '../drafting/removedPile';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';

interface CubeDeckbuilderPageProps {
  cube: Cube;
  initialDeck: Draft;
}

// The table addresses rows a board may not have yet (e.g. an empty sideboard).
const withRow = (board: number[][][], row: number): number[][][] =>
  board.length > row ? board : [...board, ...Array.from({ length: row + 1 - board.length }, () => [])];

const CubeDeckbuilderPage: React.FC<CubeDeckbuilderPageProps> = ({ cube, initialDeck }) => {
  const searchParams = new URLSearchParams(window.location.search);
  const seatIndex = parseInt(searchParams.get('seat') || '0', 10);
  // The card pool is mutable now: the Add Card control appends new cards beyond
  // the original pool, which are submitted as `newCards` on save.
  const [cards, setCards] = useState<CardType[]>(initialDeck.cards);
  const originalCardCount = initialDeck.cards.length;
  const [mainboard, setMainboard] = useState<number[][][]>(
    initialDeck.seats[seatIndex]?.mainboard || initialDeck.seats[0].mainboard,
  );
  const [sideboard, setSideboard] = useState<number[][][]>(
    initialDeck.seats[seatIndex]?.sideboard || initialDeck.seats[0].sideboard,
  );
  // Session-only: removed cards are dropped on save, like before.
  const [removed, setRemoved] = useState<number[]>([]);
  const seat = initialDeck.seats[seatIndex];
  const [deckTitle, setDeckTitle] = useState(seat?.title || '');
  // The server fills in the drafter's first pick when none was chosen; decks without picks
  // (sealed, uploads) fall back to the cube's image, as their preview does.
  const [previewImage, setPreviewImage] = useState(initialDeck.previewImage || `/cubeimage/${cube.id}`);
  // Only set once the user drops a card on the thumbnail; sent on save.
  const [previewCardID, setPreviewCardID] = useState<string>();

  const { basics } = initialDeck;

  // Use a card's art as the deck's image.
  const applyCardArt = useCallback(
    (cardIndex: number | undefined) => {
      const card = cardIndex !== undefined ? cards[cardIndex] : undefined;
      if (card?.details?.art_crop) {
        setPreviewImage(card.details.art_crop);
        setPreviewCardID(card.cardID);
      }
    },
    [cards],
  );

  // A tap on a card sends it to the other board, at the end of its natural pile.
  const toggleBoard = useCallback(
    (source: DraftLocation) => {
      const sourceBoard = source.type === 'deck' ? mainboard : sideboard;
      const cardIndex = sourceBoard[source.row][source.col][source.index];
      const card = cards[cardIndex];
      const isCreature = cardType(card).toLowerCase().includes('creature');
      const cmc = cmcColumn(card);

      const newTarget =
        source.type === 'deck'
          ? DraftLocation.sideboard(0, cmc, sideboard[0]?.[cmc]?.length || 0)
          : DraftLocation.deck(isCreature ? 0 : 1, cmc, mainboard[isCreature ? 0 : 1]?.[cmc]?.length || 0);

      const setSource = source.type === 'deck' ? setMainboard : setSideboard;
      const targetLocation = newTarget.type === 'deck' ? mainboard : sideboard;
      const setTarget = newTarget.type === 'deck' ? setMainboard : setSideboard;

      const [removedCard, newSourceLocation] = removeCard(sourceBoard, source);
      setSource(newSourceLocation);
      setTarget(addCard(withRow(targetLocation, newTarget.row), newTarget, removedCard));
    },
    [mainboard, sideboard, cards],
  );

  // Table moves: target.index already assumes the card is out of its pile.
  const moveOnTable = useCallback(
    (source: DraftLocation, target: DraftLocation) => {
      const boardFor = (type: string) => (type === 'deck' ? mainboard : sideboard);
      const setterFor = (type: string) => (type === 'deck' ? setMainboard : setSideboard);
      const [card, rest] = removeCard(boardFor(source.type), source);
      if (source.type === target.type) {
        setterFor(source.type)(addCard(withRow(rest, target.row), target, card));
      } else {
        setterFor(source.type)(rest);
        setterFor(target.type)(addCard(withRow(boardFor(target.type), target.row), target, card));
      }
    },
    [mainboard, sideboard],
  );

  const removeOnTable = useCallback(
    (source: DraftLocation) => {
      const result = discardToPile(source.type === 'deck' ? mainboard : sideboard, source, removed);
      (source.type === 'deck' ? setMainboard : setSideboard)(result.board);
      setRemoved(result.pile);
    },
    [mainboard, sideboard, removed],
  );

  const restoreOnTable = useCallback(
    (pileIndex: number, target: DraftLocation) => {
      const board = withRow(target.type === 'deck' ? mainboard : sideboard, target.row);
      const result = restoreFromPile(removed, pileIndex, board, target);
      (target.type === 'deck' ? setMainboard : setSideboard)(result.board);
      setRemoved(result.pile);
    },
    [mainboard, sideboard, removed],
  );

  const addBasics = useCallback(
    (numBasics: number[]) => {
      const toAdd = numBasics.map((count, index) => new Array(count).fill(basics[index])).flat();
      const newDeck = [...mainboard];
      newDeck[1][0] = ([] as any[]).concat(newDeck[1][0], toAdd);
      setMainboard(newDeck);
    },
    [mainboard, basics],
  );

  // Append an arbitrary card to the deck. The card is added to the pool and
  // placed in its default mainboard cell; on save it's submitted as a newCard.
  const addCardToDeck = useCallback(
    (details: CardDetails) => {
      const card = detailsToCard(details);
      const newIndex = cards.length;
      const { row, col } = getCardDefaultRowColumn(card);
      setCards((prev) => [...prev, card]);
      setMainboard((prev) => addCard(prev, DraftLocation.deck(row, col, prev[row]?.[col]?.length || 0), newIndex));
    },
    [cards],
  );

  // Re-bucket both boards' columns by a card attribute (color, mana value,
  // rarity, or type), leaving each card in the row it's already in.
  const sortDeck = useCallback(
    (key: DeckSortKey) => {
      setMainboard((prev) => sortDeckIntoColumns(prev, cards, key));
      setSideboard((prev) => sortDeckIntoColumns(prev, cards, key));
    },
    [cards],
  );

  // Split both boards into creature / non-creature rows, keeping each card's column.
  const splitCreatures = useCallback(() => {
    setMainboard((prev) => splitDeckByCreature(prev, cards));
    setSideboard((prev) => splitDeckByCreature(prev, cards));
  }, [cards]);

  // Resolve deckbuild settings from cube
  const maxSpells = cube.deckbuildSpells ?? 23;
  const maxLands = cube.deckbuildLands ?? 17;

  // Whether autobuild ran before saving, so the deck_build event can attribute the save.
  const [autobuilt, setAutobuilt] = useState(false);
  const markAutobuilt = useCallback(() => setAutobuilt(true), []);

  const renderNavbar = (layout: 'bar' | 'list' | 'save') => (
    <DeckbuilderNavbar
      cards={cards}
      basics={basics}
      mainboard={mainboard}
      sideboard={sideboard}
      cubeID={cube.id}
      draft={initialDeck}
      addBasics={addBasics}
      setDeck={setMainboard}
      setSideboard={setSideboard}
      seat={seatIndex}
      deckTitle={deckTitle}
      previewCardID={previewCardID}
      maxSpells={maxSpells}
      maxLands={maxLands}
      onAddCard={addCardToDeck}
      defaultPrinting={cube.defaultPrinting}
      originalCardCount={originalCardCount}
      onSort={sortDeck}
      onSplitCreatures={splitCreatures}
      autobuilt={autobuilt}
      onAutobuilt={markAutobuilt}
      layout={layout}
    />
  );

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="playtest">
        <Container xl disableCenter>
          <BotDeckStatusBanner
            draftId={initialDeck.id}
            initiallyPending={initialDeck.botDecksPending}
            initiallyFailed={initialDeck.botDecksFailed}
          />
          <DeckBuilderStatsPanel
            cards={mainboard
              .flat()
              .flat()
              .map((index) => cards[index])}
          />
          <DynamicFlash />
        </Container>
        {/* Edge to edge on phones, where room is tight. */}
        <div className="-mx-2 md:mx-0 md:px-2">
          <ErrorBoundary>
            <DeckTable
              cards={cards}
              mainboard={mainboard}
              sideboard={sideboard}
              removed={removed}
              deckTitle={deckTitle}
              onDeckTitleChange={setDeckTitle}
              deckNamePlaceholder={seat?.name || 'Deck name...'}
              previewImage={previewImage}
              renderToolbar={renderNavbar}
              onMove={moveOnTable}
              onRemove={removeOnTable}
              onRestore={restoreOnTable}
              onToggleBoard={toggleBoard}
              onSetArt={applyCardArt}
            />
          </ErrorBoundary>
        </div>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeDeckbuilderPage);
