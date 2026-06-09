import React, { useCallback, useState } from 'react';

import { DndContext, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { cardType, cmcColumn, detailsToCard, makeSubtitle } from '@utils/cardutil';
import CardType, { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import { getCardDefaultRowColumn } from '@utils/draftutil';

import DeckBuilderStatsPanel from 'components/DeckBuilderStatsPanel';

import { Card } from '../components/base/Card';
import Container from '../components/base/Container';
import Text from '../components/base/Text';
import DeckbuilderNavbar from '../components/DeckbuilderNavbar';
import DeckStacks from '../components/DeckStacks';
import DynamicFlash from '../components/DynamicFlash';
import ErrorBoundary from '../components/ErrorBoundary';
import RenderToRoot from '../components/RenderToRoot';
import { DisplayContextProvider } from '../contexts/DisplayContext';
import DraftLocation, { addCard, locations, moveCard, removeCard } from '../drafting/DraftLocation';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';

interface CubeDeckbuilderPageProps {
  cube: Cube;
  initialDeck: Draft;
}

// Drop target for discarding a card out of the deck entirely.
const RemoveZone: React.FC = () => {
  const { setNodeRef, isOver } = useDroppable({ id: 'deckbuilder-remove', data: { type: 'remove' } });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-center border-2 border-dashed rounded-md py-4 mx-2 mb-3 transition-colors ${
        isOver ? 'border-danger bg-danger/10' : 'border-border text-text-secondary'
      }`}
    >
      <Text semibold>{isOver ? 'Release to remove card' : 'Drag a card here to remove it from the deck'}</Text>
    </div>
  );
};

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
  const [dragStartTime, setDragStartTime] = useState<number | null>(null);

  const { basics } = initialDeck;

  const handleMoveCard = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      //If drag and drop ends without a collision, eg outside the drag/drop area, do nothing
      if (!over) {
        return;
      }

      const source = active.data.current as DraftLocation;
      const target = over.data.current as DraftLocation | { type: string };

      // Dropped onto the remove zone: pull the card out of its board and discard.
      if ((target as { type: string })?.type === 'remove') {
        if (source.type !== 'deck' && source.type !== 'sideboard') {
          return;
        }
        const sourceLocation = source.type === 'deck' ? mainboard : sideboard;
        const setSource = source.type === 'deck' ? setMainboard : setSideboard;
        const [, newSourceLocation] = removeCard(sourceLocation, source);
        setSource(newSourceLocation);
        return;
      }

      const targetLoc = target as DraftLocation;

      if (source.equals(targetLoc)) {
        // player dropped card back in the same location
        const dragTime = Date.now() - (dragStartTime ?? 0);

        if (dragTime < 200) {
          // if the drag was too quick, it was a click so we move the card to the other location
          const sourceBoard = source.type === 'deck' ? mainboard : sideboard;
          const cardIndex = sourceBoard[source.row][source.col][source.index];
          const card = cards[cardIndex];
          const isCreature = cardType(card).toLowerCase().includes('creature');
          const cmc = cmcColumn(card);

          const newTarget =
            source.type === 'deck'
              ? DraftLocation.sideboard(0, cmc, sideboard[0][cmc]?.length || 0)
              : DraftLocation.deck(isCreature ? 0 : 1, cmc, mainboard[isCreature ? 0 : 1][cmc]?.length || 0);

          // moving cards between mainboard and sideboard
          const sourceLocation = source.type === 'deck' ? mainboard : sideboard;
          const setSource = source.type === 'deck' ? setMainboard : setSideboard;

          const targetLocation = newTarget.type === 'deck' ? mainboard : sideboard;
          const setTarget = newTarget.type === 'deck' ? setMainboard : setSideboard;

          const [removedCard, newSourceLocation] = removeCard(sourceLocation, source);
          setSource(newSourceLocation);

          setTarget(addCard(targetLocation, newTarget, removedCard));
        }

        return;
      }

      if (source.type === 'pack' || targetLoc.type === 'pack') {
        // there are no packs in the deckbuilder
        return;
      }

      if (source.type === targetLoc.type) {
        // moving cards within the same location
        const location = source.type === 'deck' ? mainboard : sideboard;
        const updateLocation = source.type === 'deck' ? setMainboard : setSideboard;

        updateLocation(moveCard(location, source, targetLoc));
      } else {
        // moving cards between mainboard and sideboard
        const sourceLocation = source.type === 'deck' ? mainboard : sideboard;
        const setSource = source.type === 'deck' ? setMainboard : setSideboard;

        const targetLocation = targetLoc.type === 'deck' ? mainboard : sideboard;
        const setTarget = targetLoc.type === 'deck' ? setMainboard : setSideboard;

        const [card, newSourceLocation] = removeCard(sourceLocation, source);
        setSource(newSourceLocation);

        setTarget(addCard(targetLocation, targetLoc, card));
      }
    },
    [mainboard, sideboard, setMainboard, setSideboard, cards, dragStartTime],
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

  // Resolve deckbuild settings from cube
  const maxSpells = cube.deckbuildSpells ?? 23;
  const maxLands = cube.deckbuildLands ?? 17;

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <Container xl disableCenter>
            <DeckbuilderNavbar
              cards={cards}
              basics={basics}
              mainboard={mainboard}
              sideboard={sideboard}
              cubeID={cube.id}
              draft={initialDeck}
              addBasics={addBasics}
              className="mb-3"
              setDeck={setMainboard}
              setSideboard={setSideboard}
              seat={seatIndex}
              maxSpells={maxSpells}
              maxLands={maxLands}
              onAddCard={addCardToDeck}
              defaultPrinting={cube.defaultPrinting}
              originalCardCount={originalCardCount}
            />
            <DeckBuilderStatsPanel
              cards={mainboard
                .flat()
                .flat()
                .map((index) => cards[index])}
            />
            <DynamicFlash />
            <Card className="my-3">
              <DndContext onDragEnd={handleMoveCard} onDragStart={() => setDragStartTime(Date.now())}>
                <ErrorBoundary>
                  <DeckStacks
                    cards={mainboard.map((col) => col.map((row) => row.map((index) => cards[index])))}
                    title="Deck"
                    subtitle={makeSubtitle(
                      mainboard
                        .flat()
                        .flat()
                        .map((index) => cards[index]),
                    )}
                    locationType={locations.deck}
                    xs={4}
                    lg={8}
                  />
                  <DeckStacks
                    cards={sideboard.map((col) => col.map((row) => row.map((index) => cards[index])))}
                    title="Sideboard"
                    locationType={locations.sideboard}
                    subtitle={makeSubtitle(
                      sideboard
                        .flat()
                        .flat()
                        .map((index) => cards[index]),
                    )}
                    xs={4}
                    lg={8}
                  />
                  <RemoveZone />
                </ErrorBoundary>
              </DndContext>
            </Card>
          </Container>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubeDeckbuilderPage);
