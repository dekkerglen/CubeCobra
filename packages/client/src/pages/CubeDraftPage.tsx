import React, { useCallback, useContext, useEffect, useRef, useMemo, useState } from 'react';

import { DndContext } from '@dnd-kit/core';
import { isVoucher, makeSubtitle } from '@utils/cardutil';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import { getCardDefaultRowColumn, getInitialState, setupPicks } from '@utils/draftutil';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
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
import { modelScoresToProbabilities } from '../utils/botRatings';
import { loadDraftBot, localBatchDraftRanked } from '../utils/draftBot';

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

const localBatchPredict = async (inputs: BatchPredictRequest[]): Promise<PredictResponse> => {
  const ranked = await localBatchDraftRanked(inputs.map((i) => ({ pack: i.pack, pool: i.picks })));
  return { prediction: ranked };
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

  return modelScoresToProbabilities(rawRatings);
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
  const { csrfFetch } = useContext(CSRFContext);

  // Load the draft bot model in the background as soon as the page mounts.
  // modelReadyRef lets getPredictions await it without re-rendering on load completion.
  const modelReadyRef = useRef<Promise<void> | null>(null);
  useEffect(() => {
    modelReadyRef.current = loadDraftBot();
  }, []);

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
          // guarantee that we're submitting with userPicksInOrder
          state: {
            ...state,
            seats: [{ ...state.seats[0], picks: userPicksInOrder, trashed: trashboard }, ...state.seats.slice(1)],
          },
          mainboard,
          sideboard,
        }),
        timeout: 60 * 1000, //Match server-side timeout
      });

      // Force error if status is not 2xx range
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      } else {
        window.location.href = `/draft/deckbuilder/${draft.id}`;
      }
    } catch (err) {
      console.error('endDraft error caught:', err);
      addAlert('danger', 'Error finishing draft, please reach out to the Discord');
      setDraftStatus((prev) => ({ ...prev, loading: false, draftCompleted: false }));
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
        // Ensure the model is loaded before making predictions (no-op if already loaded)
        if (modelReadyRef.current) await modelReadyRef.current;

        const inputs = request.state.seats.map((seat: any) => ({
          pack: seat.pack.flatMap((index: number) => getCardOracleIds(index)),
          picks: seat.picks.flatMap((index: number) => getCardOracleIds(index)),
        }));

        const json = await localBatchPredict(inputs);
        setCurrentPredictions(json);
        setRatings(processPredictions(json, request.packCards));
        return json;
      } catch (error) {
        console.error('Error getting predictions:', error, 'inputs', request.state);
        setDraftStatus((prev) => ({ ...prev, predictError: true }));
        return null;
      } finally {
        setDraftStatus((prev) => ({ ...prev, predictionsLoading: false }));
      }
    },
    [getCardOracleIds],
  );

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

        // Get ratings for new pack after it's opened
        if (newState.seats[0].pack.length > 0) {
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
  }, [draft.cards, state, getPredictions]);

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
