import React, { useCallback, useContext, useState } from 'react';

import Cube from 'datatypes/Cube';
import Draft from 'datatypes/Draft';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import DeckbuilderNavbar from 'components/DeckbuilderNavbar';
import DeckStacks from 'components/DeckStacks';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import RenderToRoot from 'components/RenderToRoot';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import UserContext from 'contexts/UserContext';
import DraftSeat from 'datatypes/DraftSeat';
import User from 'datatypes/User';
import DraftLocation, { addCard, locations, moveCard, removeCard } from 'drafting/DraftLocation';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { cardType, makeSubtitle } from 'utils/Card';
import { Card } from 'components/base/Card';

const getMatchingSeat = (seats: DraftSeat[], userid?: string) =>
  seats
    .map((seat, index) => [seat, index] as [DraftSeat, number])
    .find((tuple) => (tuple[0]?.owner as User).id === userid)?.[1] ?? 0;

interface CubeDeckbuilderPageProps {
  cube: Cube;
  initialDeck: Draft;
  loginCallback: string;
}

const CubeDeckbuilderPage: React.FC<CubeDeckbuilderPageProps> = ({ cube, initialDeck, loginCallback }) => {
  const user = useContext(UserContext);
  const [seat] = useState(getMatchingSeat(initialDeck.seats, user?.id));
  const [mainboard, setMainboard] = useState<number[][][]>(initialDeck.seats[seat].mainboard);
  const [sideboard, setSideboard] = useState<number[][][]>(initialDeck.seats[seat].sideboard);
  const [dragStartTime, setDragStartTime] = useState<number | null>(null);

  const { basics } = initialDeck;

  const handleMoveCard = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over) {
        return;
      }

      const source = active.data.current as DraftLocation;
      const target = over.data.current as DraftLocation;

      if (source.equals(target)) {
        // player dropped card back in the same location
        const dragTime = Date.now() - (dragStartTime ?? 0);

        if (dragTime < 200) {
          // if the drag was too quick, it was a click so we move the card to the other location

          const isCreature = cardType(initialDeck.cards[source.index]).toLowerCase().includes('creature');

          const newTarget =
            source.type === 'deck'
              ? DraftLocation.sideboard(0, source.col, sideboard[0][source.col].length)
              : DraftLocation.deck(isCreature ? 0 : 1, source.col, mainboard[isCreature ? 0 : 1][source.col].length);

          console.log(newTarget);

          // moving cards between mainboard and sideboard
          const sourceLocation = source.type === 'deck' ? mainboard : sideboard;
          const setSource = source.type === 'deck' ? setMainboard : setSideboard;

          const targetLocation = newTarget.type === 'deck' ? mainboard : sideboard;
          const setTarget = newTarget.type === 'deck' ? setMainboard : setSideboard;

          const [card, newSourceLocation] = removeCard(sourceLocation, source);
          setSource(newSourceLocation);

          setTarget(addCard(targetLocation, newTarget, card));
        }

        return;
      }

      if (source.type === 'pack' || target.type === 'pack') {
        // there are no packs in the deckbuilder
        return;
      }

      if (source.type === target.type) {
        // moving cards within the same location
        const location = source.type === 'deck' ? mainboard : sideboard;
        const updateLocation = source.type === 'deck' ? setMainboard : setSideboard;

        updateLocation(moveCard(location, source, target));
      } else {
        // moving cards between mainboard and sideboard
        const sourceLocation = source.type === 'deck' ? mainboard : sideboard;
        const setSource = source.type === 'deck' ? setMainboard : setSideboard;

        const targetLocation = target.type === 'deck' ? mainboard : sideboard;
        const setTarget = target.type === 'deck' ? setMainboard : setSideboard;

        const [card, newSourceLocation] = removeCard(sourceLocation, source);
        setSource(newSourceLocation);

        setTarget(addCard(targetLocation, target, card));
      }
    },
    [locations, mainboard, sideboard, setMainboard, setSideboard, initialDeck, dragStartTime],
  );

  const addBasics = useCallback(
    (numBasics: number[]) => {
      console.log(numBasics);
      const toAdd = numBasics.map((count, index) => new Array(count).fill(basics[index])).flat();
      const newDeck = [...mainboard];
      newDeck[1][0] = ([] as any[]).concat(newDeck[1][0], toAdd);
      console.log(newDeck);
      setMainboard(newDeck);
    },
    [mainboard, basics, initialDeck],
  );

  return (
    <MainLayout loginCallback={loginCallback}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest" hasControls>
          <DeckbuilderNavbar
            cards={initialDeck.cards}
            basics={basics}
            mainboard={mainboard}
            sideboard={sideboard}
            cubeID={cube.id}
            draftId={initialDeck.id}
            addBasics={addBasics}
            className="mb-3"
            setDeck={setMainboard}
            setSideboard={setSideboard}
            seat={seat}
          />
          <DynamicFlash />
          <Card className="my-3">
            <DndContext onDragEnd={handleMoveCard} onDragStart={() => setDragStartTime(Date.now())}>
              <ErrorBoundary>
                <DeckStacks
                  cards={mainboard.map((col) => col.map((row) => row.map((index) => initialDeck.cards[index])))}
                  title="Deck"
                  subtitle={makeSubtitle(
                    mainboard
                      .flat()
                      .flat()
                      .map((index) => initialDeck.cards[index]),
                  )}
                  locationType={locations.deck}
                />
                <DeckStacks
                  cards={sideboard.map((col) => col.map((row) => row.map((index) => initialDeck.cards[index])))}
                  title="Sideboard"
                  locationType={locations.sideboard}
                  subtitle={makeSubtitle(
                    sideboard
                      .flat()
                      .flat()
                      .map((index) => initialDeck.cards[index]),
                  )}
                />
              </ErrorBoundary>
            </DndContext>
          </Card>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubeDeckbuilderPage);
