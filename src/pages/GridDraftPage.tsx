import { Card } from 'components/base/Card';
import Input from 'components/base/Input';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import CSRFForm from 'components/CSRFForm';
import DeckStacks from 'components/DeckStacks';
import GridDraftPack from 'components/draft/GridDraftPack';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import RenderToRoot from 'components/RenderToRoot';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import Cube from 'datatypes/Cube';
import Draft from 'datatypes/Draft';
import DraftLocation, { addCard, locations } from 'drafting/DraftLocation';
import { getDefaultPosition } from 'drafting/draftutil';
import { calculateGridBotPick, getGridDrafterState } from 'drafting/griddraftutils';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { makeSubtitle } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import { fromEntries, toNullableInt } from 'utils/Util';

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
      useCallback(
        ({ seatIndex, cardIndices }: { seatIndex: number; cardIndices: number[][] }) =>
          setGridDraft((oldGridDraft) => {
            const newGridDraft = { ...oldGridDraft };
            newGridDraft.seats = [...newGridDraft.seats];
            newGridDraft.seats[seatIndex] = { ...newGridDraft.seats[seatIndex] };
            mutation({ newGridDraft, seatIndex, cardIndices });
            return newGridDraft;
          }),
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
  loginCallback?: string;
}

const GridDraftPage: React.FC<GridDraftPageProps> = ({ cube, initialDraft, seatNumber, loginCallback }) => {
  const { cards } = initialDraft;
  const draftType = initialDraft.seats[1].bot ? 'bot' : '2playerlocal';
  const seatNum = toNullableInt(seatNumber?.toString() ?? '') ?? 0;
  const { gridDraft, mutations } = useMutatableGridDraft(initialDraft);
  const submitDeckForm = useRef<HTMLFormElement>(null);
  const drafterStates = useMemo(() => {
    return [0, 1].map((idx) => getGridDrafterState({ gridDraft, seatNumber: idx }));
  }, [gridDraft]);
  console.log(drafterStates);
  const { turn, numPacks, packNum, pickNum } = drafterStates[seatNum];
  const { cardsInPack } = drafterStates[turn ? 0 : 1];
  const doneDrafting = packNum >= numPacks;
  const pack = useMemo(() => cardsInPack.map((cardIndex: number) => cards[cardIndex]), [cardsInPack, cards]);

  // picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const picked = useMemo(
    () =>
      gridDraft.seats.map(({ mainboard }) =>
        mainboard.map((row) => row.map((col) => col.map((cardIndex) => cards[cardIndex]))),
      ),
    [gridDraft, cards],
  );
  const botIndex = (seatNum + 1) % 2;
  const botDrafterState = drafterStates[botIndex];

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
  }, [doneDrafting, gridDraft]);

  useEffect(() => {
    if (botDrafterState.turn && draftType === 'bot') {
      const cardIndices = calculateGridBotPick(botDrafterState).map(
        (pick: any[]) => [pick[0], pick[1]] as [number, number],
      );
      mutations.makePick({ cardIndices, seatIndex: botIndex });
    }
  }, [draftType, botDrafterState, mutations, botIndex]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <DynamicFlash />
          <CSRFForm
            ref={submitDeckForm}
            method="POST"
            action={`/cube/deck/submitdeck/${initialDraft.cube}`}
            formData={{ body: initialDraft.id }}
          >
            <Input type="hidden" name="body" value={initialDraft.id} />
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
              <DeckStacks
                cards={picked[0]}
                title={draftType === 'bot' ? 'Picks' : "Player One's picks"}
                subtitle={makeSubtitle(picked[0].flat(3))}
                locationType={locations.deck}
                xs={4}
                md={8}
              />
            </Card>
            <Card className="my-3">
              <DeckStacks
                cards={picked[1]}
                title={draftType === 'bot' ? 'Bot picks' : "Player Two's picks"}
                subtitle={makeSubtitle(picked[1].flat(3))}
                locationType={locations.deck}
                xs={4}
                md={8}
              />
            </Card>
          </ErrorBoundary>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(GridDraftPage);
