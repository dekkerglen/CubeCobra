import React, { useCallback, useContext, useEffect, useState } from 'react';

import { DndContext } from '@dnd-kit/core';

import { Card } from 'components/base/Card';
import DeckStacks from 'components/DeckStacks';
import Pack from 'components/Pack';
import AutocardContext from 'contexts/AutocardContext';
import { CSRFContext } from 'contexts/CSRFContext';
import CardInterface from 'datatypes/Card';
import Draft from 'datatypes/Draft';
import DraftLocation, { addCard, location, locations, removeCard } from 'drafting/DraftLocation';
import { draftStateToTitle, setupPicks } from 'drafting/draftutil';
import useMount from 'hooks/UseMount';
import { cardCmc, cardType, makeSubtitle } from 'utils/Card';

interface CubeDraftProps {
  draft: Draft;
  socket: {
    on: (event: string, callback: (data: any) => void) => void;
    emit: (event: string, data: any) => void;
  };
}

const getCardsDeckStackPosition = (card: CardInterface): { row: number; col: number } => {
  const isCreature = cardType(card).toLowerCase().includes('creature');
  const cmc = cardCmc(card);

  const row = isCreature ? 0 : 1;
  const col = Math.max(0, Math.min(7, cmc));

  return { row, col };
};

const fetchPicks = async (callApi: any, draft: Draft, seat: number) => {
  const res = await callApi('/multiplayer/getpicks', {
    draft: draft.id,
    seat,
  });
  const json = await res.json();
  const picks = setupPicks(2, 8);

  for (const index of json.picks) {
    const { row, col } = getCardsDeckStackPosition(draft.cards[index]);
    picks[row][col].push(index);
  }

  return picks;
};

const fetchPack = async (callApi: any, draft: Draft, seat: number) => {
  const res = await callApi('/multiplayer/getpack', {
    draft: draft.id,
    seat,
  });
  const json = await res.json();
  return json.data;
};

let staticPicks: any[][][];

let seat = 0;

const CubeDraft: React.FC<CubeDraftProps> = ({ draft, socket }) => {
  const { callApi } = useContext(CSRFContext);
  const [packQueue, setPackQueue] = useState<any[]>([]);
  const [pack, setPack] = useState<number[]>([]);
  const [mainboard, setMainboard] = useState<any[][][]>(setupPicks(2, 8));
  const [sideboard, setSideboard] = useState<any[][][]>(setupPicks(1, 8));
  const [loading, setLoading] = useState(true);
  const [stepQueue, setStepQueue] = useState<string[]>([]);
  const [trashed, setTrashed] = useState<number[]>([]);
  const [dragStartTime, setDragStartTime] = useState<number | null>(null);
  const { hideCard } = useContext(AutocardContext);

  const disabled = stepQueue[0] === 'pickrandom' || stepQueue[0] === 'trashrandom';

  staticPicks = mainboard;

  const tryPopPack = useCallback(async () => {
    if (packQueue.length > 0 && pack.length === 0) {
      const data = packQueue.shift();
      setPack(data.pack);
      setStepQueue(data.steps);
    } else {
      setLoading(true);
    }
  }, [pack, packQueue]);

  const makePick = useCallback(
    async (pick: number) => {
      hideCard();

      if (stepQueue[1] === 'pass' || pack.length < 1) {
        tryPopPack();
      } else {
        const slice = stepQueue.slice(1, stepQueue.length);
        setStepQueue(slice);
        setPack(pack.filter((_, index) => index !== pick));
        setLoading(false);
      }

      await callApi('/multiplayer/draftpick', { draft: draft.id, seat, pick });
    },
    [hideCard, stepQueue, pack, callApi, draft.id, tryPopPack],
  );

  const updatePack = async (data: any) => {
    if (pack.length === 0) {
      setPack(data.pack);
      setStepQueue(data.steps);
    } else {
      setPackQueue([...packQueue, data]);
    }
  };

  const delayedTryBotPicksLoop = async () => {
    // the trybotpicks response will eventually flip this status to 'done'
    let status = 'inProgress';
    while (status === 'inProgress') {
      // we want to do this first as we don't want to spam the server
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const res = await callApi('/multiplayer/trybotpicks', {
          draft: draft.id,
        });
        if (res) {
          const json = await res.json();
          status = json.result;

          if (json.picks === 0) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            continue;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  useMount(() => {
    const run = async () => {
      const getSeat = await callApi('/multiplayer/getseat', { draftid: draft.id });
      const seatJson = await getSeat.json();
      seat = parseInt(seatJson.seat);

      console.log('Joining draft', seatJson);

      socket.emit('joinDraft', { draftId: draft.id, seat });

      socket.on('draft', async (data: any) => {
        if (data.finished === 'true') {
          const res = await callApi('/multiplayer/editdeckbydraft', {
            draftId: draft.id,
            seat,
            mainboard: staticPicks,
            sideboard: setupPicks(1, 8),
          });
          const json = await res.json();

          window.location.href = `/cube/deck/deckbuilder/${json.deck}`;
        }
      });
      socket.on('seat', (data: any) => {
        updatePack(data);
        setLoading(false);
      });

      setMainboard(await fetchPicks(callApi, draft, seat));
      updatePack(await fetchPack(callApi, draft, seat));
      setLoading(false);

      if (seat === 0) {
        delayedTryBotPicksLoop();
      }
    };
    run();
  });

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
    [mainboard, sideboard],
  );

  //When a card is chosen from the pack
  const applyCardSelectionForStep = useCallback(
    (packIndex: number, locationType: location, row: number, col: number, targetIndex: number = -1) => {
      const cardIndex = pack[packIndex];

      if (stepQueue[0] === 'pick' || stepQueue[0] === 'pickrandom') {
        const { board, setter } = getLocationReferences(locationType);
        const gridPositionCardCount = board[row][col].length;
        /*
         * Move card into the stack within the target grid position (row/col). If the index isn't known, such as
         * because we clicked to move, then adds to the end of the stack. Be extra careful that the target index fits within
         * the array of cards in this grid position
         */
        const placementIndex =
          targetIndex === -1 || targetIndex < 0 || targetIndex > gridPositionCardCount
            ? gridPositionCardCount
            : targetIndex;
        setter(addCard(board, new DraftLocation(locationType, row, col, placementIndex), cardIndex));
      } else if (stepQueue[0] === 'trash' || stepQueue[0] === 'trashrandom') {
        setTrashed([...trashed, cardIndex]);
      }

      makePick(packIndex);
    },
    [getLocationReferences, makePick, pack, stepQueue, trashed],
  );

  const selectCardByIndex = useCallback(
    (packIndex: number) => {
      const cardIndex = pack[packIndex];
      const card = draft.cards[cardIndex];

      const { row, col } = getCardsDeckStackPosition(card);
      applyCardSelectionForStep(packIndex, locations.deck, row, col);
    },
    [pack, draft.cards, applyCardSelectionForStep],
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
        //Add card to the target, then update the source with the cards minus the moved card
        targetSetter(addCard(targetBoard, target, card));
        sourceSetter(newCards);
      }
    },
    [getLocationReferences],
  );

  /*
   * Clicking on a card within either deck stack moves it to the other. Unlike a drag where we have different source and targets,
   * on a click we only have the source. We determine the target location based on the source card's cmc/type (getCardsDeckStackPosition)
   * though if moving to the sideboard only the CMC matters to determine the column.
   */
  /*const applyCardClickOnDeckStack = useCallback(
    (source: DraftLocation) => {
      //Determine the card which was clicked in the board, so we can calculate its standard row/col destination
      const { board: sourceBoard } = getLocationReferences(source.type);
      const cardIndex = sourceBoard[source.row][source.col][source.index];
      const card = draft.cards[cardIndex];
      const { row, col } = getCardsDeckStackPosition(card);

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
  );*/

  //Move card between Pack and/or DeckStacks
  const onMoveCard = useCallback(
    async (event: any) => {
      const { active, over } = event;

      if (!over) {
        return;
      }

      const source = active.data.current as DraftLocation;
      const target = over.data.current as DraftLocation;

      if (source.equals(target) && source.type === locations.pack) {
        // player dropped card back in the same location
        const dragTime = Date.now() - (dragStartTime ?? 0);

        if (dragTime < 200) {
          return selectCardByIndex(source.index);
        }
        //TODO: Uncomment alongside the sideboard DeckStacks
      } /*else if (source.equals(target) && (source.type === locations.deck || source.type === locations.sideboard)) {
        //Clicking a card within the deck or sideboard should move it from one to the other
        applyCardClickOnDeckStack(source);
        return;
      }*/ else if (source.equals(target)) {
        return;
      }

      if (target.type === locations.pack) {
        console.error("Can't move cards inside pack.");
        return;
      }

      if (source.type === locations.pack) {
        if (target.type === locations.deck || target.type === locations.sideboard) {
          applyCardSelectionForStep(source.index, target.type, target.row, target.col, target.index);
        }

        return;
      }

      moveCardBetweenDeckStacks(source, target);
    },
    [moveCardBetweenDeckStacks, dragStartTime, selectCardByIndex, applyCardSelectionForStep],
  );

  useEffect(() => {
    if (
      stepQueue[0] &&
      (stepQueue[0] === 'pickrandom' || stepQueue[0] === 'trashrandom') &&
      pack.length > 0 &&
      !loading
    ) {
      setLoading(true);
      setTimeout(() => {
        selectCardByIndex(Math.floor(Math.random() * pack.length));
      }, 1000);
    }
  }, [stepQueue, selectCardByIndex, pack, loading]);

  return (
    <DndContext onDragEnd={onMoveCard} onDragStart={() => setDragStartTime(Date.now())}>
      <Pack
        pack={pack.map((index) => draft.cards[index])}
        loading={loading}
        title={draftStateToTitle(
          draft,
          mainboard,
          trashed,
          loading,
          stepQueue.map((step) => ({ action: step })),
        )}
        disabled={disabled}
      />
      <Card className="my-3">
        <DeckStacks
          cards={mainboard.map((row) => row.map((col) => col.map((index) => draft.cards[index])))}
          title="Mainboard"
          subtitle={makeSubtitle(mainboard.flat(3).map((index) => draft.cards[index]))}
          locationType={locations.deck}
          xs={4}
          lg={8}
        />
        {/* 
        
        We can add this back when we have a mechanism to push cards to the sideboard on end of draft.
        There is no tracking of positions of cards in either the mainboard or sideboard at the moment.
          
        <DeckStacks
          cards={sideboard.map((row) => row.map((col) => col.map((index) => draft.cards[index])))}
          title="Sideboard"
          locationType={locations.sideboard}
          xs={4}
          lg={8}
        /> */}
      </Card>
    </DndContext>
  );
};

export default CubeDraft;
