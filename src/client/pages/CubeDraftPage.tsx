import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DndContext } from '@dnd-kit/core';
import type { State } from 'src/router/routes/draft/finish.ts';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import DeckStacks from 'components/DeckStacks';
import Pack from 'components/Pack';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import Cube from 'datatypes/Cube';
import Draft, { DraftStep } from 'datatypes/Draft';
import DraftLocation, { addCard, location, removeCard } from 'drafting/DraftLocation';
import { locations } from 'drafting/DraftLocation';
import useLocalStorage from 'hooks/useLocalStorage';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { makeSubtitle } from 'utils/cardutil';

import { getCardDefaultRowColumn, setupPicks } from '../../util/draftutil';

interface CubeDraftPageProps {
  cube: Cube;
  draft: Draft;
  loginCallback?: string;
}

interface PredictResponse {
  prediction: {
    oracle: string;
    rating: number;
  }[][];
}

interface BatchPredictRequest {
  pack: string[];
  picks: string[];
}

const fetchBatchPredict = async (inputs: BatchPredictRequest[]): Promise<PredictResponse> => {
  // Add a 5-second delay to help test the pending pick functionality
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const response = await fetch('/api/draftbots/batchpredict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch batch predictions: ${response.status}`);
  }

  return response.json();
};

const processPredictions = (json: PredictResponse, packCards: any[]) => {
  // Create a map of oracle IDs to ratings
  const predictionsMap = new Map(json.prediction[0].map((p) => [p.oracle, p.rating]));
  // Then add ratings to packCards while maintaining pack order
  return packCards.map((card) => predictionsMap.get(card.oracle_id) || 0);
};

const getInitialState = (draft: Draft): State => {
  const stepQueue: DraftStep[] = [];

  if (draft.InitialState) {
    // only look at the first seat
    const seat = draft.InitialState[0];

    for (const pack of seat) {
      stepQueue.push(...pack.steps, { action: 'endpack', amount: null });
    }
  }

  // if there are no picks made, return the initial state
  return {
    seats: draft.seats.map((_, index) => ({
      picks: [],
      trashed: [],
      pack: draft.InitialState ? draft.InitialState[index][0].cards : [],
    })),
    stepQueue,
    pack: 1,
    pick: 1,
  };
};

interface DraftStatus {
  loading: boolean;
  predictionsLoading: boolean;
  predictError: boolean;
  retryInProgress: boolean;
}

const CubeDraftPage: React.FC<CubeDraftPageProps> = ({ cube, draft, loginCallback }) => {
  // Draft State
  // These reflect the current state of the draft objects, including the cards in the pack, the picks made, and the ratings for each card.
  const [state, setState] = useLocalStorage(`draftstate-${draft.id}`, getInitialState(draft));
  const [mainboard, setMainboard] = useLocalStorage(`mainboard-${draft.id}`, setupPicks(2, 8));
  const [sideboard, setSideboard] = useLocalStorage(`sideboard-${draft.id}`, setupPicks(1, 8));
  const [ratings, setRatings] = useState<number[]>([]);
  const [currentPredictions, setCurrentPredictions] = useState<PredictResponse | null>(null);

  // Add state to track the pending pick made during predictionsLoading
  const [pendingPick, setPendingPick] = useState<number | null>(null);

  // Draft Status
  // These are used to track the status of the draft itself, including loading, errors, etc.
  const [draftStatus, setDraftStatus] = useState<DraftStatus>({
    loading: false,
    predictionsLoading: false,
    predictError: false,
    retryInProgress: false,
  });

  const [dragStartTime, setDragStartTime] = useState<number | null>(null);
  const { csrfFetch } = useContext(CSRFContext);

  const getLocationReferences = useCallback(
    (type: location): { board: any[][][]; setter: React.Dispatch<React.SetStateAction<any[][][]>> } => {
      if (type === locations.deck) {
        return {
          board: mainboard,
          setter: setMainboard,
        };
      } else {
        return {
          board: sideboard,
          setter: setSideboard,
        };
      }
    },
    [mainboard, setMainboard, setSideboard, sideboard],
  );

  const endDraft = useCallback(async () => {
    setDraftStatus((prev) => ({ ...prev, loading: true }));

    try {
      const response = await csrfFetch(`/draft/finish/${draft.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state,
          mainboard,
          sideboard,
        }),
      });

      // Force error if status is not 2xx range
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      } else {
        window.location.href = `/draft/deckbuilder/${draft.id}`;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('endDraft error caught:', err);
      setDraftStatus((prev) => ({ ...prev, loading: false }));
    }
  }, [csrfFetch, draft.id, mainboard, sideboard, state, setDraftStatus]);

  const getPredictions = useCallback(
    async (request: { state: any; packCards: { index: number; oracle_id: string }[] }) => {
      setDraftStatus((prev) => ({ ...prev, predictionsLoading: true, predictError: false }));
      try {
        const inputs = request.state.seats.map((seat: any) => ({
          pack: seat.pack
            .map((index: number) => draft.cards[index]?.details?.oracle_id)
            .filter((id: string | undefined): id is string => Boolean(id)),
          picks: seat.picks
            .map((index: number) => draft.cards[index]?.details?.oracle_id)
            .filter((id: string | undefined): id is string => Boolean(id)),
        }));

        const json = await fetchBatchPredict(inputs);
        setCurrentPredictions(json);
        setRatings(processPredictions(json, request.packCards));
        return json;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching predictions:', error, 'inputs', request.state);
        setDraftStatus((prev) => ({ ...prev, predictError: true }));
        return null;
      } finally {
        setDraftStatus((prev) => ({ ...prev, predictionsLoading: false }));
      }
    },
    [draft.cards],
  );

  const handleRetryPredict = useCallback(async () => {
    if (draftStatus.retryInProgress || !state?.seats?.[0]?.pack) {
      return;
    }

    setDraftStatus((prev) => ({ ...prev, retryInProgress: true }));
    try {
      const currentState = state;
      const packCards = currentState.seats[0].pack.map((index) => ({
        index,
        oracle_id: draft.cards[index]?.details?.oracle_id || '',
      }));
      await getPredictions({ state: currentState, packCards });
    } finally {
      setDraftStatus((prev) => ({ ...prev, retryInProgress: false }));
    }
  }, [state, draft.cards, getPredictions, draftStatus.retryInProgress, setDraftStatus]);

  const makePick = useCallback(
    async (index: number, location: location) => {
      setDraftStatus((prev) => ({ ...prev, loading: true }));
      setRatings([]);
      const newState = { ...state };
      const currentStep = newState.stepQueue[0];

      if (currentStep.action.includes('pick')) {
        // User picks are combination of mainboard and sideboard
        const picks = location === locations.deck ? [...mainboard.flat(2), ...sideboard.flat(2)] : [];
        newState.seats[0].picks = picks;
      }

      // if amount is more than 1
      if (currentStep.amount && currentStep.amount > 1) {
        // we will decrement the amount and make the pick
        newState.stepQueue[0] = { ...currentStep, amount: currentStep.amount - 1 };
      } else {
        // we need to pop the current step
        newState.stepQueue.shift();
      }

      if (!currentStep) {
        // This should never happen, but if it does, the draft finishing should be in progress
        setDraftStatus((prev) => ({ ...prev, loading: false }));
        return;
      }

      if (currentStep.action === 'endpack' || currentStep.action === 'pass') {
        // This should never happen
        setDraftStatus((prev) => ({ ...prev, loading: false }));
        return;
      }

      if (currentStep.action === 'pick' || currentStep.action === 'trash') {
        // Use existing predictions for bot picks
        if (currentPredictions?.prediction) {
          const picks = currentPredictions.prediction.slice(1).map((seat, index) => {
            const pack = state.seats[index + 1].pack.map((i) => draft.cards[i].details?.oracle_id);

            if (pack.length === 0) {
              return -1;
            }

            if (seat.length === 0) {
              // pick at random
              return Math.floor(Math.random() * pack.length);
            }

            const oracle = seat.reduce((prev, current) => (prev.rating > current.rating ? prev : current)).oracle;
            return pack.findIndex((oracleId) => oracleId === oracle);
          });

          // make all the picks
          if (currentStep.action === 'pick') {
            newState.seats[0].picks.unshift(state.seats[0].pack[index]);
          } else if (currentStep.action === 'trash') {
            newState.seats[0].trashed.unshift(state.seats[0].pack[index]);
          }
          newState.seats[0].pack.splice(index, 1);

          for (let i = 1; i < state.seats.length; i++) {
            const pick = picks[i - 1];

            if (currentStep.action === 'pick') {
              newState.seats[i].picks.unshift(state.seats[i].pack[pick]);
            } else if (currentStep.action === 'trash') {
              newState.seats[i].trashed.unshift(state.seats[i].pack[pick]);
            }
            newState.seats[i].pack.splice(pick, 1);
          }
        }
      } else if (currentStep.action === 'pickrandom' || currentStep.action === 'trashrandom') {
        // make random selection
        if (currentStep.action === 'pickrandom') {
          newState.seats[0].picks.unshift(state.seats[0].pack[index]);
          for (let i = 1; i < state.seats.length; i++) {
            const randomIndex = Math.floor(Math.random() * state.seats[i].pack.length);
            newState.seats[i].picks.unshift(state.seats[i].pack[randomIndex]);
            newState.seats[i].pack.splice(randomIndex, 1);
          }
        } else if (currentStep.action === 'trashrandom') {
          newState.seats[0].trashed.unshift(state.seats[0].pack[index]);

          for (let i = 1; i < state.seats.length; i++) {
            const randomIndex = Math.floor(Math.random() * state.seats[i].pack.length);
            newState.seats[i].trashed.unshift(randomIndex);
            newState.seats[i].pack.splice(randomIndex, 1);
          }
        }
        newState.seats[0].pack.splice(index, 1);
      }

      // get the next step
      const nextStep = newState.stepQueue[0];

      // either pass the pack, open the next pack, or end the draft
      if (!nextStep) {
        // should never happen
        setDraftStatus((prev) => ({ ...prev, loading: false }));
        return;
      }

      if (nextStep.action === 'pass') {
        // pass left on an odd pick, right on an even pick
        const direction = state.pack % 2 === 0 ? 1 : -1;
        const packs = newState.seats.map((seat) => seat.pack);

        for (let i = 0; i < state.seats.length; i++) {
          const nextSeat = newState.seats[(i + direction + draft.seats.length) % state.seats.length];
          nextSeat.pack = packs[i];
        }

        newState.pick += 1;

        // pop the step
        newState.stepQueue.shift();
      }

      if (nextStep.action === 'endpack') {
        // we open the next pack or end the draft
        if (draft.InitialState && state.pack === draft.InitialState[0].length) {
          setState(newState);
          setDraftStatus((prev) => ({ ...prev, loading: false }));

          // Now attempt to end the draft
          await endDraft();
          return;
        }

        // open the next pack
        newState.pack += 1;
        newState.pick = 1;

        for (let i = 0; i < state.seats.length; i++) {
          newState.seats[i].pack = draft.InitialState ? draft.InitialState[i][newState.pack - 1].cards : [];
        }

        // pop the step
        newState.stepQueue.shift();

        // Clear ratings before opening new pack
        setRatings([]);

        // Get ratings for new pack after it's opened
        if (newState.seats[0].pack.length > 0) {
          const request = {
            state: newState,
            packCards: newState.seats[0].pack
              .map((index) => ({
                index,
                oracle_id: draft.cards[index]?.details?.oracle_id || '',
              }))
              .filter((card): card is { index: number; oracle_id: string } => Boolean(card.oracle_id)),
          };

          await getPredictions(request);
        }
      }

      setState(newState);
      setDraftStatus((prev) => ({ ...prev, loading: false }));
    },
    [
      draftStatus.predictError,
      draftStatus.loading,
      state,
      setState,
      currentPredictions,
      draft.cards,
      draft.seats.length,
      draft.InitialState,
      endDraft,
      getPredictions,
      mainboard,
      sideboard,
    ],
  );

  // Compute displayed pack, excluding the pending pick
  const displayedPackIndices =
    pendingPick !== null ? state.seats[0].pack.filter((_, i) => i !== pendingPick) : state.seats[0].pack;
  const displayedPack = displayedPackIndices.map((index) => draft.cards[index]);
  const mainboardCards = mainboard.map((row) => row.map((col) => col.map((index) => draft.cards[index])));
  const sideboardCards = sideboard.map((row) => row.map((col) => col.map((index) => draft.cards[index])));

  // Function to handle initial draft pick from pack to deck
  const handlePackPick = useCallback(
    (source: DraftLocation, target: DraftLocation) => {
      if (pendingPick !== null) return;

      if (source.index < 0 || source.index >= state.seats[0].pack.length) return;

      const cardIndex = state.seats[0].pack[source.index];
      if (cardIndex === undefined || !draft.cards[cardIndex]) return;

      if (draftStatus.predictionsLoading) {
        setPendingPick(source.index);

        const setter = target.type === locations.deck ? setMainboard : setSideboard;
        setter((prev) => {
          const newBoard = prev.map((r) => r.map((c) => [...c]));
          newBoard[target.row][target.col].push(cardIndex);
          return newBoard;
        });
      } else {
        // Update the board immediately
        const setter = target.type === locations.deck ? setMainboard : setSideboard;
        setter((prev) => {
          const newBoard = prev.map((r) => r.map((c) => [...c]));
          newBoard[target.row][target.col].push(cardIndex);
          return newBoard;
        });

        // Make the pick after the board update
        makePick(source.index, target.type);
      }
    },
    [
      draftStatus.predictionsLoading,
      draft.cards,
      makePick,
      pendingPick,
      setPendingPick,
      setMainboard,
      setSideboard,
      state.seats,
    ],
  );

  const moveCardBetweenDeckStacks = useCallback(
    (source: DraftLocation, target: DraftLocation) => {
      const { board: sourceBoard, setter: sourceSetter } = getLocationReferences(source.type);

      //Moving within the same DeckStack
      if (source.type === target.type) {
        const [card, newCards] = removeCard(sourceBoard, source);
        sourceSetter(addCard(newCards, target, card));
      } else {
        const { board: targetBoard, setter: targetSetter } = getLocationReferences(target.type);
        const [card, newCards] = removeCard(sourceBoard, source);
        targetSetter(addCard(targetBoard, target, card));
        sourceSetter(newCards);
      }
    },
    [getLocationReferences],
  );

  // Modified selectCardByIndex to make it more robust
  const selectCardByIndex = useCallback(
    (packIndex: number) => {
      if (packIndex < 0 || packIndex >= state.seats[0].pack.length) {
        return;
      }

      const cardIndex = state.seats[0].pack[packIndex];
      if (cardIndex === undefined) {
        return;
      }

      const card = draft.cards[cardIndex];
      if (!card) {
        return;
      }

      const { row, col } = getCardDefaultRowColumn(card);

      if (draftStatus.predictionsLoading) {
        setMainboard((prev) => {
          const newBoard = prev.map((r) => r.map((c) => [...c]));
          newBoard[row][col].push(cardIndex);
          return newBoard;
        });
        setPendingPick(packIndex);
      } else {
        // First update the board visually
        setMainboard((prev) => {
          const newBoard = prev.map((r) => r.map((c) => [...c]));
          newBoard[row][col].push(cardIndex);
          return newBoard;
        });

        // Then make the pick in the draft state
        makePick(packIndex, locations.deck);
      }
    },
    [state.seats, draft.cards, makePick, draftStatus.predictionsLoading, setMainboard, setPendingPick],
  );

  /*
   * Clicking on a card within either deck stack moves it to the other. Unlike a drag where we have different source and targets,
   * on a click we only have the source. We determine the target location based on the source card's cmc/type (getCardDefaultRowColumn)
   * though if moving to the sideboard only the CMC matters to determine the column.
   */
  const applyCardClickOnDeckStack = useCallback(
    (source: DraftLocation) => {
      //Determine the card which was clicked in the board, so we can calculate its standard row/col destination
      const { board: sourceBoard } = getLocationReferences(source.type);
      const cardIndex = sourceBoard[source.row][source.col][source.index];
      const card = draft.cards[cardIndex];
      const { row, col } = getCardDefaultRowColumn(card);

      const targetLocation = source.type === locations.deck ? locations.sideboard : locations.deck;
      //The sideboard only has one row, unlike the deck with has 1 row for creatures and 1 for non-creatures
      const targetRow = targetLocation === locations.sideboard ? 0 : row;
      const { board: targetBoard } = getLocationReferences(targetLocation);

      //The card should be added to the end of the stack of cards at the grid position (row/col). Be extra careful
      //with the boards (using .? operator) even though they are pre-populated via setupPicks() at the top
      const targetIndex = targetBoard?.[targetRow]?.[col]?.[source.index] || 0;
      moveCardBetweenDeckStacks(source, new DraftLocation(targetLocation, targetRow, col, targetIndex));
    },
    [draft.cards, getLocationReferences, moveCardBetweenDeckStacks],
  );

  // Replace onMoveCard with updated implementation
  const onMoveCard = useCallback(
    async (event: any) => {
      const { active, over } = event;
      if (!over) return;

      const sourceData = active.data.current;
      const targetData = over.data.current;
      const source = new DraftLocation(sourceData.type, sourceData.row, sourceData.col, sourceData.index);
      const target = new DraftLocation(targetData.type, targetData.row, targetData.col, targetData.index);

      if (source.equals(target) && source.type === locations.pack) {
        const dragTime = Date.now() - (dragStartTime ?? 0);
        if (dragTime < 200) {
          return selectCardByIndex(source.index);
        }
        return;
      } else if (source.equals(target) && (source.type === locations.deck || source.type === locations.sideboard)) {
        applyCardClickOnDeckStack(source);
        return;
      } else if (source.equals(target)) {
        return;
      }

      if (target.type === locations.pack) {
        return;
      }

      if (source.type === locations.pack) {
        if (target.type === locations.deck || target.type === locations.sideboard) {
          handlePackPick(source, target);
          return;
        }
      }

      // Deck reorganization
      moveCardBetweenDeckStacks(source, target);
    },
    [applyCardClickOnDeckStack, dragStartTime, moveCardBetweenDeckStacks, selectCardByIndex, handlePackPick],
  );

  // Replace the useEffect for pendingPick processing to be more robust
  useEffect(() => {
    if (!draftStatus.predictionsLoading && pendingPick !== null) {
      const packIndex = pendingPick;
      // Clear pendingPick immediately to prevent race conditions
      setPendingPick(null);

      // Verify the pending pick is still valid
      if (packIndex < 0 || packIndex >= state.seats[0].pack.length) {
        return;
      }

      const cardIndex = state.seats[0].pack[packIndex];
      if (cardIndex === undefined) {
        return;
      }

      if (!draft.cards[cardIndex]) {
        return;
      }

      makePick(packIndex, locations.deck);
    }
  }, [draftStatus.predictionsLoading, pendingPick, makePick, state.seats, draft.cards, setPendingPick]);

  // this is the auto-pick logic
  useEffect(() => {
    if (
      state.stepQueue[0] &&
      (state.stepQueue[0].action === 'pickrandom' || state.stepQueue[0].action === 'trashrandom') &&
      state.seats[0].pack.length > 0 &&
      !draftStatus.loading
    ) {
      setDraftStatus((prev) => ({ ...prev, loading: true }));
      setTimeout(() => {
        //Automatically select a card from the pack, by picking a random index position within the available card pack
        selectCardByIndex(Math.floor(Math.random() * state.seats[0].pack.length));
      }, 1000);
    }
  }, [selectCardByIndex, draftStatus.loading, state.stepQueue, state.seats]);

  // P1P1 ratings fetch necessary, the rest come via makePick
  useEffect(() => {
    const fetchInitialRatings = async () => {
      if (state?.seats?.[0]?.pack?.length > 0) {
        const request = {
          state,
          packCards: state.seats[0].pack.map((index) => ({
            index,
            oracle_id: draft.cards[index]?.details?.oracle_id || '',
          })),
        };
        await getPredictions(request);
      }
    };

    fetchInitialRatings();
  }, [draft.cards, state, getPredictions]);

  const packTitle: string = useMemo(() => {
    const nextStep = state.stepQueue[0];

    if (draftStatus.loading) {
      if (state.stepQueue.length <= 1) {
        return 'Finishing up draft...';
      }

      return 'Waiting for next pack...';
    }

    switch (nextStep.action) {
      case 'pick':
        return `Pack ${state.pack} Pick ${state.pick}: Pick ${nextStep.amount} card${nextStep.amount && nextStep.amount > 1 ? 's' : ''}`;
      case 'trash':
        return `Pack ${state.pack} Pick ${state.pick}: Trash ${nextStep.amount} card${nextStep.amount && nextStep.amount > 1 ? 's' : ''}`;
      case 'endpack':
        return 'Waiting for next pack to open...';
      case 'pickrandom':
        return 'Picking random selection...';
      case 'trashrandom':
        return 'Trashing random selection...';
      default:
        return '';
    }
  }, [state, draftStatus.loading]);

  const packDisabled =
    state.stepQueue[0].action === 'pickrandom' ||
    state.stepQueue[0].action === 'trashrandom' ||
    draftStatus.predictError ||
    pendingPick !== null;

  return (
    <MainLayout loginCallback={loginCallback}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <DndContext onDragEnd={onMoveCard} onDragStart={() => setDragStartTime(Date.now())}>
            <div className="relative">
              {/* Only show the pack if there are actually cards to show */}
              {state?.seats?.[0]?.pack?.length > 0 ? (
                draftStatus.predictionsLoading && pendingPick !== null ? (
                  <Card className="mt-3">
                    <CardHeader className="flex justify-between items-center">
                      <Text semibold lg>
                        Waiting for Bot Picks...
                      </Text>
                    </CardHeader>
                    <CardBody>
                      <div className="centered py-3">
                        <div className="spinner" />
                      </div>
                    </CardBody>
                  </Card>
                ) : (
                  <Pack
                    pack={displayedPack}
                    loading={draftStatus.loading}
                    title={packTitle}
                    disabled={packDisabled || draftStatus.retryInProgress}
                    ratings={ratings}
                    error={draftStatus.predictError}
                    onRetry={handleRetryPredict}
                    retryInProgress={draftStatus.retryInProgress}
                  />
                )
              ) : (
                <></>
              )}
              <Card className="my-3">
                <DeckStacks
                  cards={mainboardCards}
                  title="Mainboard"
                  subtitle={makeSubtitle(mainboard.flat(3).map((index) => draft.cards[index]))}
                  locationType={locations.deck}
                  xs={4}
                  lg={8}
                />
                <DeckStacks cards={sideboardCards} title="Sideboard" locationType={locations.sideboard} xs={4} lg={8} />
              </Card>
            </div>
          </DndContext>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubeDraftPage);
