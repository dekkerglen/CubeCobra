import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DndContext } from '@dnd-kit/core';
import { isVoucher, makeSubtitle } from '@utils/cardutil';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import { getCardDefaultRowColumn, getInitialState, setupPicks } from '@utils/draftutil';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import DeckStacks from 'components/DeckStacks';
import Pack from 'components/Pack';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import DraftLocation, { addCard, location, removeCard } from 'drafting/DraftLocation';
import { locations } from 'drafting/DraftLocation';
import useAlerts, { Alerts } from 'hooks/UseAlerts';
import useLocalStorage from 'hooks/useLocalStorage';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubeDraftPageProps {
  cube: Cube;
  draft: Draft;
}

interface PredictResponse {
  prediction: {
    oracle: string;
    rating: number;
  }[][];
}

interface DraftStatus {
  loading: boolean;
  predictionsLoading: boolean;
  predictError: boolean;
  retryInProgress: boolean;
  draftCompleted: boolean;
}

interface BatchPredictRequest {
  pack: string[];
  picks: string[];
}

const fetchBatchPredict = async (
  inputs: BatchPredictRequest[],
  cubeContext: number[] | null,
): Promise<PredictResponse> => {
  const body: { inputs: BatchPredictRequest[]; cubeContext?: number[] } = { inputs };
  if (cubeContext && cubeContext.length > 0) {
    body.cubeContext = cubeContext;
  }

  //Unlike csrfFetch which has a default client time, a fetch like this doesn't.
  const response = await fetch('/api/draftbots/batchpredict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch batch predictions: ${response.status}`);
  }

  return response.json();
};

const fetchCubeContext = async (cubeId: string): Promise<number[] | null> => {
  try {
    const response = await fetch('/api/draftbots/cubecontext', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cubeId }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data?.embedding) ? (data.embedding as number[]) : null;
  } catch {
    return null;
  }
};

const processPredictions = (json: PredictResponse, packCards: any[]): number[] => {
  // Create a map of oracle IDs to ratings
  const predictionsMap = new Map(json.prediction[0].map((p) => [p.oracle, p.rating]));
  // Then add ratings to packCards while maintaining pack order
  // For vouchers, sum the ratings of their unique sub-cards (picking a voucher gives you ALL sub-cards)
  const rawRatings = packCards.map((card): number => {
    if (card.voucherOracleIds && card.voucherOracleIds.length > 0) {
      // Use Set to deduplicate oracle_ids - ML returns one rating per unique oracle
      const uniqueOracleIds = [...new Set<string>(card.voucherOracleIds as string[])];
      return uniqueOracleIds.reduce((acc: number, oracleId: string) => acc + (predictionsMap.get(oracleId) || 0), 0);
    }
    return predictionsMap.get(card.oracle_id) || 0;
  });

  // Normalize: duplicates get the same rating, then normalize so total = 100%
  const total = rawRatings.reduce((acc, r) => acc + r, 0);
  return total > 0 ? rawRatings.map((r) => r / total) : rawRatings;
};

const CubeDraftPage: React.FC<CubeDraftPageProps> = ({ cube, draft }) => {
  /**
   * Expand a picked card index into board entries. For normal cards, returns [{ cardIndex, row, col }].
   * For vouchers, returns entries for each of the voucher's sub-cards (using pre-expanded indices).
   * The voucher itself is NOT added to the player's board.
   */
  const expandPickForBoard = useCallback(
    (cardIndex: number): { cardIndex: number; row: number; col: number }[] => {
      const card = draft.cards[cardIndex];
      if (!card) return [{ cardIndex, ...getCardDefaultRowColumn(card) }];

      if (isVoucher(card) && card.voucher_card_indices && card.voucher_card_indices.length > 0) {
        // Use pre-expanded sub-card indices from draft creation
        return card.voucher_card_indices.map((subCardIndex) => {
          const subCard = draft.cards[subCardIndex];
          return { cardIndex: subCardIndex, ...getCardDefaultRowColumn(subCard) };
        });
      }

      return [{ cardIndex, ...getCardDefaultRowColumn(card) }];
    },
    [draft.cards],
  );

  // Draft State
  // These reflect the current state of the draft objects, including the cards in the pack, the picks made, and the ratings for each card.
  const [state, setState] = useLocalStorage(`draftstate-${draft.id}`, getInitialState(draft));
  const [mainboard, setMainboard] = useLocalStorage(`mainboard-${draft.id}`, setupPicks(2, 8));
  const [sideboard, setSideboard] = useLocalStorage(`sideboard-${draft.id}`, setupPicks(1, 8));
  const [trashboard, setTrashboard] = useLocalStorage<number[]>(`trashboard-${draft.id}`, []);
  const [ratings, setRatings] = useState<number[]>([]);
  const [currentPredictions, setCurrentPredictions] = useState<PredictResponse | null>(null);
  const [userPicksInOrder, setUserPicksInOrder] = useLocalStorage<number[]>(`picks-${draft.id}`, []); // Tracks the pick sequencing, managed separately from the mainboard/sideboard state
  const [pendingPick, setPendingPick] = useState<number | null>(null); // Add state to track the pending pick made during predictionsLoading
  // Cube context embedding (32-dim) — computed once per cube, persisted in localStorage so we don't re-fetch on reload.
  const [cubeContextEmbedding, setCubeContextEmbedding] = useLocalStorage<number[] | null>(
    `cube-context-${cube.id}`,
    null,
  );
  // Resolves true once the cube-context fetch has completed (with or without a value).
  // We gate prediction calls on this so bot picks committed during the live draft
  // and the post-draft breakdown both see the same context.
  const [cubeContextReady, setCubeContextReady] = useState<boolean>(
    Boolean(cubeContextEmbedding && cubeContextEmbedding.length > 0),
  );

  const { alerts, addAlert } = useAlerts();

  // Draft Status
  // These are used to track the status of the draft itself, including loading, errors, etc.
  const [draftStatus, setDraftStatus] = useState<DraftStatus>({
    loading: false, // We're not showing a pack because we're waiting for something
    predictionsLoading: false, // We're waiting for the bots to make a pick
    predictError: false, // Bot predict call failed
    retryInProgress: false, // User's attempting to handle that failure
    draftCompleted: false, // We've made the final pick and are ready to endDraft
  });

  const [dragStartTime, setDragStartTime] = useState<number | null>(null);
  const [deckbuildProgress, setDeckbuildProgress] = useState<{ step: number; totalSteps: number } | null>(null);
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
    setDeckbuildProgress(null);

    const draftState = {
      ...state,
      seats: [{ ...state.seats[0], picks: userPicksInOrder, trashed: trashboard }, ...state.seats.slice(1)],
    };

    try {
      // Phase 1: Start iterative deckbuilding (runs batchBuild — 1 ML call)
      const startResponse = await csrfFetch(`/draft/deckbuild/start/${draft.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: draftState }),
      });

      if (!startResponse.ok) {
        throw new Error(`Deckbuild start failed: ${startResponse.status}`);
      }

      let result = await startResponse.json();
      setDeckbuildProgress({ step: result.step, totalSteps: result.totalSteps });

      // Phase 2: Step through draft picks one at a time (~30 iterations, 1 ML call each)
      while (!result.complete) {
        const stepResponse = await csrfFetch(`/draft/deckbuild/step/${draft.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!stepResponse.ok) {
          throw new Error(`Deckbuild step failed: ${stepResponse.status}`);
        }

        result = await stepResponse.json();
        setDeckbuildProgress({ step: result.step, totalSteps: result.totalSteps });
      }

      // Phase 3: Submit the finished draft with pre-built bot decks (no ML calls needed)
      const finishResponse = await csrfFetch(`/draft/finish/${draft.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: draftState,
          mainboard,
          sideboard,
          botDecks: result.botDecks,
        }),
        timeout: 60 * 1000,
      });

      if (!finishResponse.ok) {
        throw new Error(`HTTP error! Status: ${finishResponse.status}`);
      }

      window.location.href = `/draft/deckbuilder/${draft.id}`;
    } catch (err) {
      console.error('endDraft error caught:', err);
      addAlert(
        'danger',
        'Error finishing draft, please reach out to the Discord linking the cube, draft, and a screenshot',
      );
      setDraftStatus((prev) => ({ ...prev, loading: false, draftCompleted: false }));
      setDeckbuildProgress(null);
    }
  }, [csrfFetch, draft.id, mainboard, userPicksInOrder, sideboard, state, setDraftStatus, trashboard, addAlert]);

  // Helper to get oracle_ids from a card, expanding vouchers to sub-card oracle_ids
  const getCardOracleIds = useCallback(
    (index: number): string[] => {
      const card = draft.cards[index];
      if (!card) return [];

      if (isVoucher(card)) {
        // Prefer voucher_card_indices (pre-expanded at draft creation), fallback to voucher_cards
        if (card.voucher_card_indices && card.voucher_card_indices.length > 0) {
          return card.voucher_card_indices
            .map((idx) => draft.cards[idx]?.details?.oracle_id)
            .filter((id): id is string => Boolean(id));
        }
        if (card.voucher_cards && card.voucher_cards.length > 0) {
          return card.voucher_cards.map((vc) => vc.details?.oracle_id).filter((id): id is string => Boolean(id));
        }
      }

      return card.details?.oracle_id ? [card.details.oracle_id] : [];
    },
    [draft.cards],
  );

  const getPredictions = useCallback(
    async (request: { state: any; packCards: { index: number; oracle_id: string; voucherOracleIds?: string[] }[] }) => {
      setDraftStatus((prev) => ({ ...prev, predictionsLoading: true, predictError: false }));
      try {
        const inputs = request.state.seats.map((seat: any) => ({
          pack: seat.pack.flatMap((index: number) => getCardOracleIds(index)),
          picks: seat.picks.flatMap((index: number) => getCardOracleIds(index)),
        }));

        const json = await fetchBatchPredict(inputs, cubeContextEmbedding);
        setCurrentPredictions(json);
        setRatings(processPredictions(json, request.packCards));
        return json;
      } catch (error) {
        console.error('Error fetching predictions:', error, 'inputs', request.state);
        setDraftStatus((prev) => ({ ...prev, predictError: true }));
        return null;
      } finally {
        setDraftStatus((prev) => ({ ...prev, predictionsLoading: false }));
      }
    },
    [getCardOracleIds, cubeContextEmbedding],
  );

  // Fetch the cube context embedding once and cache it. The 32-dim vector is shared
  // across every batchpredict call for this cube, so we only need to encode it once.
  useEffect(() => {
    if (cubeContextEmbedding && cubeContextEmbedding.length > 0) {
      setCubeContextReady(true);
      return;
    }

    let cancelled = false;
    fetchCubeContext(cube.id).then((embedding) => {
      if (cancelled) return;
      if (embedding) setCubeContextEmbedding(embedding);
      setCubeContextReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [cube.id, cubeContextEmbedding, setCubeContextEmbedding]);

  const handleRetryPredict = useCallback(async () => {
    if (draftStatus.retryInProgress || !state?.seats?.[0]?.pack) {
      return;
    }

    setDraftStatus((prev) => ({ ...prev, retryInProgress: true }));
    try {
      const currentState = state;
      const packCards = currentState.seats[0].pack.map((index) => {
        const card = draft.cards[index];
        const voucherOracleIds =
          isVoucher(card) && card?.voucher_cards
            ? card.voucher_cards.map((vc) => vc.details?.oracle_id).filter((id): id is string => Boolean(id))
            : undefined;
        return {
          index,
          oracle_id: card?.details?.oracle_id || '',
          voucherOracleIds,
        };
      });
      await getPredictions({ state: currentState, packCards });
    } finally {
      setDraftStatus((prev) => ({ ...prev, retryInProgress: false }));
    }
  }, [state, draft.cards, getPredictions, draftStatus.retryInProgress, setDraftStatus]);

  const makePick = useCallback(
    async (packIndex: number) => {
      setDraftStatus((prev) => ({ ...prev, loading: true }));
      setRatings([]); // Clear ratings
      const newState = { ...state };
      const currentStep = newState.stepQueue[0];
      if (currentStep.action.includes('pick')) {
        // Most recent pick is already in this data at this point
        newState.seats[0].picks = userPicksInOrder;
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
            const oracleIndex = pack.findIndex((oracleId) => oracleId === oracle);
            //For some reason could not map the predicted oracle id to a card in the pack, fallback to random assignment
            if (oracleIndex === -1) {
              console.log(`Best oracle id from predictions is ${oracle}, pack contains ${pack}`);
              // pick at random
              return Math.floor(Math.random() * pack.length);
            }

            return oracleIndex;
          });

          // make all the picks
          if (currentStep.action === 'pick') {
            newState.seats[0].picks.unshift(state.seats[0].pack[packIndex]);
          } else if (currentStep.action === 'trash') {
            newState.seats[0].trashed.unshift(state.seats[0].pack[packIndex]);
          }
          newState.seats[0].pack.splice(packIndex, 1);

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
          newState.seats[0].picks.unshift(state.seats[0].pack[packIndex]);
          for (let i = 1; i < state.seats.length; i++) {
            const randomIndex = Math.floor(Math.random() * state.seats[i].pack.length);
            newState.seats[i].picks.unshift(state.seats[i].pack[randomIndex]);
            newState.seats[i].pack.splice(randomIndex, 1);
          }
        } else if (currentStep.action === 'trashrandom') {
          newState.seats[0].trashed.unshift(state.seats[0].pack[packIndex]);

          for (let i = 1; i < state.seats.length; i++) {
            const randomIndex = Math.floor(Math.random() * state.seats[i].pack.length);
            newState.seats[i].trashed.unshift(randomIndex);
            newState.seats[i].pack.splice(randomIndex, 1);
          }
        }
        newState.seats[0].pack.splice(packIndex, 1);
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
          newState.seats[0].picks = userPicksInOrder;
          newState.seats[0].trashed = trashboard;
          setState(newState);
          setDraftStatus((prev) => ({ ...prev, loading: false, draftCompleted: true }));
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
      }

      // After advancing the step queue (post-pick + post-pass, or post-endpack),
      // refetch predictions whenever the next user action is another pick. This
      // is what keeps bot picks honest within a pack: without it, every seat
      // reuses the predictions computed at pack-open, and once packs pass the
      // stored predictions are for cards that have already left the pack —
      // findIndex returns -1 and bots fall back to random selection.
      const upcomingStep = newState.stepQueue[0];
      const needsRefresh =
        upcomingStep &&
        (upcomingStep.action === 'pick' ||
          upcomingStep.action === 'trash' ||
          upcomingStep.action === 'pickrandom' ||
          upcomingStep.action === 'trashrandom') &&
        newState.seats[0].pack.length > 0;

      if (needsRefresh) {
        const request = {
          state: newState,
          packCards: newState.seats[0].pack
            .map((index) => {
              const card = draft.cards[index];
              const voucherOracleIds =
                isVoucher(card) && card?.voucher_cards
                  ? card.voucher_cards.map((vc) => vc.details?.oracle_id).filter((id): id is string => Boolean(id))
                  : undefined;
              return {
                index,
                oracle_id: card?.details?.oracle_id || '',
                voucherOracleIds,
              };
            })
            .filter(
              (card) => Boolean(card.oracle_id) || Boolean(card.voucherOracleIds && card.voucherOracleIds.length > 0),
            ),
        };

        await getPredictions(request);
      }

      setState(newState);
      setDraftStatus((prev) => ({ ...prev, loading: false }));
    },
    [
      state,
      setState,
      currentPredictions,
      draft.cards,
      draft.seats.length,
      draft.InitialState,
      getPredictions,
      userPicksInOrder,
      trashboard,
    ],
  );

  const mainboardCards = mainboard.map((row) => row.map((col) => col.map((index) => draft.cards[index])));
  const sideboardCards = sideboard.map((row) => row.map((col) => col.map((index) => draft.cards[index])));

  // Function to handle initial drag, sets in the right place and sets it as pending if necessary
  const dragPickCard = useCallback(
    (source: DraftLocation, target: DraftLocation) => {
      if (pendingPick !== null) return;

      if (source.index < 0 || source.index >= state.seats[0].pack.length) return;

      const cardIndex = state.seats[0].pack[source.index];
      if (cardIndex === undefined || !draft.cards[cardIndex]) return;

      // For vouchers, expand into their contained cards instead of placing the voucher itself
      const boardEntries = expandPickForBoard(cardIndex);

      // Update the board immediately
      if (draftStatus.predictionsLoading) {
        setPendingPick(source.index);

        const setter = target.type === locations.deck ? setMainboard : setSideboard;
        setter((prev) => {
          const newBoard = prev.map((r) => r.map((c) => [...c]));
          for (const entry of boardEntries) {
            // Use drag target's row/col for the first card, default placement for the rest
            if (entry === boardEntries[0]) {
              newBoard[target.row][target.col].push(entry.cardIndex);
            } else {
              newBoard[entry.row][entry.col].push(entry.cardIndex);
            }
          }
          return newBoard;
        });
      } else {
        setUserPicksInOrder((prev) => [cardIndex, ...prev]);
        const setter = target.type === locations.deck ? setMainboard : setSideboard;
        setter((prev) => {
          const newBoard = prev.map((r) => r.map((c) => [...c]));
          for (const entry of boardEntries) {
            if (entry === boardEntries[0]) {
              newBoard[target.row][target.col].push(entry.cardIndex);
            } else {
              newBoard[entry.row][entry.col].push(entry.cardIndex);
            }
          }
          return newBoard;
        });

        // Make the actual pick after the board update
        makePick(source.index);
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
      expandPickForBoard,
      setUserPicksInOrder,
    ],
  );

  const dragCardBetweenDeckStacks = useCallback(
    (source: DraftLocation, target: DraftLocation) => {
      const { board: sourceBoard, setter: sourceSetter } = getLocationReferences(source.type);

      //Moving within the same DeckStack
      if (source.type === target.type) {
        const [card, newCards] = removeCard(sourceBoard, source);
        sourceSetter(addCard(newCards, target, card));
      } else {
        const { board: targetBoard, setter: targetSetter } = getLocationReferences(target.type);
        const [card, newCards] = removeCard(sourceBoard, source);
        //Add card to the target, then update the source with the cards minus the moved card
        targetSetter(addCard(targetBoard, target, card));
        sourceSetter(newCards);
      }
    },
    [getLocationReferences],
  );

  // Clicking on a card in the pack adds it to mainboard and sets it as pending pick if necessary
  const clickPickCard = useCallback(
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

      // For vouchers, expand into their contained cards instead of placing the voucher itself
      const boardEntries = expandPickForBoard(cardIndex);

      if (draftStatus.predictionsLoading) {
        setMainboard((prev) => {
          const newBoard = prev.map((r) => r.map((c) => [...c]));
          for (const entry of boardEntries) {
            newBoard[entry.row][entry.col].push(entry.cardIndex);
          }
          return newBoard;
        });
        setPendingPick(packIndex);
      } else {
        setMainboard((prev) => {
          setUserPicksInOrder((prev) => [cardIndex, ...prev]);
          const newBoard = prev.map((r) => r.map((c) => [...c]));
          for (const entry of boardEntries) {
            newBoard[entry.row][entry.col].push(entry.cardIndex);
          }
          return newBoard;
        });

        makePick(packIndex);
      }
    },
    [
      state.seats,
      draft.cards,
      makePick,
      draftStatus.predictionsLoading,
      setMainboard,
      setPendingPick,
      setUserPicksInOrder,
      expandPickForBoard,
    ],
  );

  /*
   * Clicking on a card within either deck stack moves it to the other. Unlike a drag where we have different source and targets,
   * on a click we only have the source. We determine the target location based on the source card's cmc/type (getCardDefaultRowColumn)
   * though if moving to the sideboard only the CMC matters to determine the column.
   */
  const clickDeckStack = useCallback(
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
      dragCardBetweenDeckStacks(source, new DraftLocation(targetLocation, targetRow, col, targetIndex));
    },
    [draft.cards, getLocationReferences, dragCardBetweenDeckStacks],
  );

  const clickTrashPick = useCallback(
    (packIndex: number) => {
      const cardIndex = state.seats[0].pack[packIndex];
      if (cardIndex === undefined || !draft.cards[cardIndex]) return;

      if (draftStatus.predictionsLoading) {
        setTrashboard((prev) => [cardIndex, ...prev]);
        setPendingPick(packIndex);
      } else {
        setTrashboard((prev) => [cardIndex, ...prev]);
        makePick(packIndex);
      }
    },
    [state.seats, draft.cards, draftStatus.predictionsLoading, setTrashboard, makePick],
  );

  const onMoveCard = useCallback(
    async (event: any) => {
      const { active, over } = event;
      //If drag and drop ends without a collision, eg outside the drag/drop area, do nothing
      if (!over) return;
      // Can't make changes while drafting is over until deckbuilding to avoid weird timing issues
      if (draftStatus.draftCompleted) return;

      const source = active.data.current as DraftLocation;
      const target = over.data.current as DraftLocation;

      // Trash picks just don't go to the mainboard or sideboard
      if (state.stepQueue[0]?.action === 'trash' && source.type === locations.pack) {
        clickTrashPick(source.index);
        return;
      }

      if (source.equals(target) && source.type === locations.pack) {
        // player dropped card back in the same location
        const dragTime = Date.now() - (dragStartTime ?? 0);
        if (dragTime < 200) {
          // If the drag was quick, treat it as a click
          return clickPickCard(source.index);
        }
        return;
      } else if (source.equals(target) && (source.type === locations.deck || source.type === locations.sideboard)) {
        //Clicking a card within the deck or sideboard should move it from one to the other
        clickDeckStack(source);
        return;
      } else if (source.equals(target)) {
        return;
      }

      if (target.type === locations.pack) {
        return;
      }
      //Dragged a card from the pack to the deck or sideboard
      if (source.type === locations.pack) {
        if (target.type === locations.deck || target.type === locations.sideboard) {
          dragPickCard(source, target);
          return;
        }
      }
      //Otherwise the drag had nothing to do with the pack
      dragCardBetweenDeckStacks(source, target);
    },
    [
      clickDeckStack,
      dragStartTime,
      dragCardBetweenDeckStacks,
      clickPickCard,
      dragPickCard,
      draftStatus.draftCompleted,
      state.stepQueue,
      clickTrashPick,
    ],
  );

  // Converts pendingPicks into real picks when we're ready
  useEffect(() => {
    //Nothing to do if no pendingPick
    if (pendingPick === null) {
      return;
    }

    //Do not act on the pendingPick if predictions are ongoing or in a bad state
    if (draftStatus.predictError || draftStatus.retryInProgress) {
      console.log('Pending pick but draft state is bad, skip');
      return;
    }

    //If we have to wait for predictions, that's OK too
    if (draftStatus.predictionsLoading) {
      return;
    }

    const packIndex = pendingPick;
    // Clear pendingPick immediately to prevent race conditions
    setPendingPick(null);
    // Some checks to verify that the pending pick is still valid
    if (packIndex < 0 || packIndex >= state.seats[0].pack.length) {
      return;
    }

    const cardIndex = state.seats[0].pack[packIndex];
    setUserPicksInOrder((prev) => [cardIndex, ...prev]);
    if (cardIndex === undefined) {
      return;
    }

    if (!draft.cards[cardIndex]) {
      return;
    }

    makePick(packIndex);
  }, [
    draftStatus.predictionsLoading,
    draftStatus.predictError,
    draftStatus.retryInProgress,
    pendingPick,
    makePick,
    state.seats,
    draft.cards,
    setPendingPick,
    setUserPicksInOrder,
  ]);

  // Add a useEffect to handle ending the draft
  useEffect(() => {
    if (draftStatus.draftCompleted) {
      endDraft();
    }
  }, [draftStatus.draftCompleted, endDraft]);

  // this is the auto-pick logic
  useEffect(() => {
    if (
      state.stepQueue[0] &&
      (state.stepQueue[0].action === 'pickrandom' || state.stepQueue[0].action === 'trashrandom') &&
      state.seats[0].pack.length > 0 &&
      !draftStatus.loading
    ) {
      setDraftStatus((prev) => ({ ...prev, loading: true }));
      if (pendingPick !== null) return;
      setTimeout(() => {
        if (state.stepQueue[0]?.action === 'trashrandom') {
          // Emulate a trash click pick on a card from the pack, by picking a random index position within the available card pack
          clickTrashPick(Math.floor(Math.random() * state.seats[0].pack.length));
        } else {
          // Emulate clicking on a random card
          clickPickCard(Math.floor(Math.random() * state.seats[0].pack.length));
        }
      }, 1000);
    }
  }, [
    draftStatus.loading,
    state.stepQueue,
    state.seats,
    draftStatus.predictionsLoading,
    makePick,
    pendingPick,
    clickPickCard,
    clickTrashPick,
  ]);

  // P1P1 ratings fetch necessary, the rest come via makePick
  // InitialRatings could eventually come along with the initial state, would require some refactoring
  useEffect(() => {
    // Wait for the cube-context fetch to resolve before firing any prediction.
    // Otherwise the bots' P1P1 picks get committed with zero context while later
    // analyses (e.g. the breakdown) re-fire with full context, causing mismatches.
    if (!cubeContextReady) return;

    const fetchInitialRatings = async () => {
      if (state?.seats?.[0]?.pack?.length > 0) {
        const request = {
          state,
          packCards: state.seats[0].pack.map((index) => {
            const card = draft.cards[index];
            const voucherOracleIds =
              isVoucher(card) && card?.voucher_cards
                ? card.voucher_cards.map((vc) => vc.details?.oracle_id).filter((id): id is string => Boolean(id))
                : undefined;
            return {
              index,
              oracle_id: card?.details?.oracle_id || '',
              voucherOracleIds,
            };
          }),
        };
        await getPredictions(request);
      }
    };

    fetchInitialRatings();
  }, [draft.cards, state, getPredictions, cubeContextReady]);

  const packTitle: string = useMemo(() => {
    const nextStep = state.stepQueue[0];

    if (draftStatus.loading) {
      if (state.stepQueue.length <= 1) {
        return 'Finishing up draft...';
      }
      if (nextStep.action !== 'pickrandom' && nextStep.action !== 'trashrandom') return 'Waiting for next pack...';
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
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <Container xl disableCenter>
            <Alerts alerts={alerts} />
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
                      // Just use state.seats[0].pack directly
                      pack={state.seats[0].pack.map((index) => draft.cards[index])}
                      loading={draftStatus.loading}
                      title={packTitle}
                      disabled={packDisabled || draftStatus.retryInProgress}
                      ratings={ratings}
                      error={draftStatus.predictError}
                      onRetry={handleRetryPredict}
                      retryInProgress={draftStatus.retryInProgress}
                    />
                  )
                ) : draftStatus.loading || draftStatus.draftCompleted ? (
                  <Card className="mt-3">
                    <CardHeader>
                      <Text semibold lg>
                        Building bot decks...
                      </Text>
                    </CardHeader>
                    <CardBody>
                      {deckbuildProgress ? (
                        <div>
                          <div className="w-full bg-bg-secondary rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-bg-active h-full rounded-full transition-all duration-200"
                              style={{
                                width: `${Math.round((deckbuildProgress.step / deckbuildProgress.totalSteps) * 100)}%`,
                              }}
                            />
                          </div>
                          <Text sm className="text-center mt-2 text-text-secondary">
                            {Math.round((deckbuildProgress.step / deckbuildProgress.totalSteps) * 100)}% — Step{' '}
                            {deckbuildProgress.step} of {deckbuildProgress.totalSteps}
                          </Text>
                        </div>
                      ) : (
                        <div className="flex justify-center py-3">
                          <Spinner md />
                        </div>
                      )}
                    </CardBody>
                  </Card>
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
                  <DeckStacks
                    cards={sideboardCards}
                    title="Sideboard"
                    locationType={locations.sideboard}
                    xs={4}
                    lg={8}
                  />
                </Card>
              </div>
            </DndContext>
          </Container>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

CubeDraftPage.displayName = 'CubeDraftPage';

export default RenderToRoot(CubeDraftPage);
