import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { makeSubtitle } from '@utils/cardutil';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import { getDefaultPosition } from '@utils/draftutil';
import { fromEntries, toNullableInt } from '@utils/Util';

import { calculateGridBotPick, getGridDrafterState } from 'drafting/griddraftutils';

import { Card } from '../components/base/Card';
import Container from '../components/base/Container';
import CSRFForm from '../components/CSRFForm';
import DeckStacks from '../components/DeckStacks';
import GridDraftPack from '../components/draft/GridDraftPack';
import DynamicFlash from '../components/DynamicFlash';
import ErrorBoundary from '../components/ErrorBoundary';
import RenderToRoot from '../components/RenderToRoot';
import { CSRFContext } from '../contexts/CSRFContext';
import { DisplayContextProvider } from '../contexts/DisplayContext';
import DraftLocation, { addCard, locations, moveCard } from '../drafting/DraftLocation';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';

const MUTATIONS = {
  makePick: ({
    newGridDraft,
    seatIndex,
    cardIndices,
  }: {
    newGridDraft: Draft;
    seatIndex: number;
    cardIndices: number[][];
  }) => {
    if (newGridDraft.seats[seatIndex]) {
      newGridDraft.seats[seatIndex].pickorder?.push(...cardIndices.map(([x]) => x));
    }
    newGridDraft.seats[seatIndex].pickedIndices?.push(...cardIndices.map(([, x]) => x));
    for (const [cardIndex] of cardIndices) {
      const pos = getDefaultPosition(newGridDraft.cards[cardIndex], newGridDraft.seats[seatIndex].mainboard);
      const location = DraftLocation.deck(pos[0], pos[1], pos[2]);
      newGridDraft.seats[seatIndex].mainboard = addCard(newGridDraft.seats[seatIndex].mainboard, location, cardIndex);
    }
  },
};

const useMutatableGridDraft = (initialGridDraft: Draft) => {
  const { cards } = initialGridDraft;
  const [gridDraft, setGridDraft] = useState(initialGridDraft);
  const mutations = fromEntries(
    Object.entries(MUTATIONS).map(([name, mutation]) => [
      name,
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useCallback(
        ({ seatIndex, cardIndices }: { seatIndex: number; cardIndices: number[][] }) =>
          setGridDraft((oldGridDraft) => {
            const newGridDraft = { ...oldGridDraft };
            newGridDraft.seats = [...newGridDraft.seats];
            newGridDraft.seats[seatIndex] = { ...newGridDraft.seats[seatIndex] };
            mutation({ newGridDraft, seatIndex, cardIndices });
            return newGridDraft;
          }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mutation, setGridDraft, cards],
      ),
    ]),
  );
  return { gridDraft, mutations };
};

interface GridDraftPageProps {
  cube: Cube;
  initialDraft: Draft;
  seatNumber?: number;
}

const GridDraftPage: React.FC<GridDraftPageProps> = ({ cube, initialDraft, seatNumber }) => {
  const { cards } = initialDraft;
  const { csrfFetch } = useContext(CSRFContext);
  const draftType = initialDraft.seats[1].bot ? 'bot' : '2playerlocal';
  const seatNum = toNullableInt(seatNumber?.toString() ?? '') ?? 0;
  const { gridDraft, mutations } = useMutatableGridDraft(initialDraft);
  const submitDeckForm = useRef<HTMLFormElement>(null);
  const drafterStates = useMemo(() => {
    return [0, 1].map((idx) => getGridDrafterState({ gridDraft, seatNumber: idx }));
  }, [gridDraft]);
  const { turn, numPacks, packNum, pickNum } = drafterStates[seatNum];
  const { cardsInPack } = drafterStates[turn ? 0 : 1];
  const doneDrafting = packNum >= numPacks;
  const pack = useMemo(() => cardsInPack.map((cardIndex: number) => cards[cardIndex]), [cardsInPack, cards]);

  const [playerOneMainboard, setPlayerOneMainboard] = useState<number[][][]>(gridDraft.seats[0]?.mainboard || []);
  const [playerTwoMainboard, setPlayerTwoMainboard] = useState<number[][][]>(gridDraft.seats[1]?.mainboard || []);

  // Sync mainboard state with gridDraft when picks are made
  useEffect(() => {
    setPlayerOneMainboard(gridDraft.seats[0]?.mainboard || []);
    setPlayerTwoMainboard(gridDraft.seats[1]?.mainboard || []);
  }, [gridDraft]);

  // picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const picked = useMemo(
    () => [
      playerOneMainboard.map((row) => row.map((col) => col.map((cardIndex) => cards[cardIndex]))),
      playerTwoMainboard.map((row) => row.map((col) => col.map((cardIndex) => cards[cardIndex]))),
    ],
    [playerOneMainboard, playerTwoMainboard, cards],
  );
  const botIndex = (seatNum + 1) % 2;
  const botDrafterState = drafterStates[botIndex];

  const handleMoveCard = useCallback(
    (event: DragEndEvent, seatIndex: number) => {
      const { active, over } = event;

      // If drag and drop ends without a collision, eg outside the drag/drop area, do nothing
      if (!over) {
        return;
      }

      const source = active.data.current as DraftLocation;
      const target = over.data.current as DraftLocation;

      // Only allow moving within the mainboard
      if (source.type !== 'deck' || target.type !== 'deck') {
        return;
      }

      if (source.equals(target)) {
        return;
      }

      const mainboard = seatIndex === 0 ? playerOneMainboard : playerTwoMainboard;
      const setMainboard = seatIndex === 0 ? setPlayerOneMainboard : setPlayerTwoMainboard;

      setMainboard(moveCard(mainboard, source, target));
    },
    [playerOneMainboard, playerTwoMainboard, setPlayerOneMainboard, setPlayerTwoMainboard],
  );

  // The finish callback.
  useEffect(() => {
    (async () => {
      if (doneDrafting) {
        await csrfFetch(`/cube/api/submitgriddraft/${gridDraft.cube}`, {
          method: 'POST',
          body: JSON.stringify({
            seats: gridDraft.seats,
            id: gridDraft.id,
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        submitDeckForm.current?.submit?.();
      }
    })();
  }, [csrfFetch, doneDrafting, gridDraft]);

  useEffect(() => {
    if (botDrafterState.turn && draftType === 'bot') {
      const cardIndices = calculateGridBotPick(botDrafterState).map(
        (pick: any[]) => [pick[0], pick[1]] as [number, number],
      );
      mutations.makePick({ cardIndices, seatIndex: botIndex });
    }
  }, [draftType, botDrafterState, mutations, botIndex]);

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <Container xl disableCenter>
            <DynamicFlash />
            <CSRFForm
              ref={submitDeckForm}
              method="POST"
              action={`/cube/deck/submitdeck/${initialDraft.cube}`}
              formData={{ body: initialDraft.id }}
            >
              {/* CSRFForm requires children, and null is a valid React node which does nothing */}
              {null}
            </CSRFForm>
            <ErrorBoundary>
              <GridDraftPack
                pack={pack}
                packNumber={packNum}
                pickNumber={pickNum}
                seatIndex={turn ? 0 : 1}
                makePick={mutations.makePick}
                turn={turn ? 1 : 2}
              />
            </ErrorBoundary>
            <ErrorBoundary>
              <Card className="mt-3">
                <DndContext onDragEnd={(event) => handleMoveCard(event, 0)}>
                  <DeckStacks
                    cards={picked[0]}
                    title={draftType === 'bot' ? 'Picks' : "Player One's picks"}
                    subtitle={makeSubtitle(picked[0].flat(3))}
                    locationType={locations.deck}
                    xs={4}
                    md={8}
                  />
                </DndContext>
              </Card>
              <Card className="my-3">
                <DndContext onDragEnd={(event) => handleMoveCard(event, 1)}>
                  <DeckStacks
                    cards={picked[1]}
                    title={draftType === 'bot' ? 'Bot picks' : "Player Two's picks"}
                    subtitle={makeSubtitle(picked[1].flat(3))}
                    locationType={locations.deck}
                    xs={4}
                    md={8}
                  />
                </DndContext>
              </Card>
            </ErrorBoundary>
          </Container>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(GridDraftPage);
