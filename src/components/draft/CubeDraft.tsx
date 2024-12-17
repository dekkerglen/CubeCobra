import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Card } from 'components/base/Card';

import DeckStacks from 'components/DeckStacks';
import Pack from 'components/Pack';
import AutocardContext from 'contexts/AutocardContext';
import DraftLocation, { locations, addCard, removeCard } from 'drafting/DraftLocation';
import { draftStateToTitle, getCardCol, setupPicks } from 'drafting/draftutil';
import useMount from 'hooks/UseMount';
import { cardCmc, cardType, makeSubtitle } from 'utils/Card';
import Draft from 'datatypes/Draft';
import { DndContext } from '@dnd-kit/core';
import { CSRFContext } from 'contexts/CSRFContext';

interface CubeDraftProps {
  draft: Draft;
  socket: {
    on: (event: string, callback: (data: any) => void) => void;
    emit: (event: string, data: any) => void;
  };
}

const fetchPicks = async (callApi: any, draft: Draft, seat: number) => {
  const res = await callApi('/multiplayer/getpicks', {
    draft: draft.id,
    seat,
  });
  const json = await res.json();
  const picks = setupPicks(2, 8);

  for (const index of json.picks) {
    picks[0][getCardCol(draft, index)].push(index);
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
    [hideCard, stepQueue, pack, draft.id, tryPopPack, seat],
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
          let json = await res.json();
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

  const onClickCard = useCallback(
    (cardIndex: number) => {
      console.log('click', cardIndex);
      const card = draft.cards[pack[cardIndex]];

      const isCreature = cardType(card).toLowerCase().includes('creature');
      const cmc = cardCmc(card);

      const row = isCreature ? 0 : 1;
      const col = Math.max(0, Math.min(7, cmc));

      setMainboard(
        addCard(mainboard, new DraftLocation(locations.deck, row, col, mainboard[row][col].length), pack[cardIndex]),
      );
      makePick(cardIndex);
    },
    [pack, mainboard, draft.cards, makePick, setMainboard],
  );

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
          return onClickCard(source.index);
        }
      } else if (source.equals(target)) {
        return;
      }

      if (target.type === locations.pack) {
        console.error("Can't move cards inside pack.");
        return;
      }

      if (source.type === locations.pack) {
        if (target.type === locations.deck) {
          if (stepQueue[0] === 'pick' || stepQueue[0] === 'pickrandom') {
            setMainboard(addCard(mainboard, target, pack[source.index]));
          } else if (stepQueue[0] === 'trash' || stepQueue[0] === 'trashrandom') {
            setTrashed([...trashed, pack[source.index]]);
          }

          makePick(source.index);
        } else if (target.type === locations.sideboard) {
          if (stepQueue[0] === 'pick' || stepQueue[0] === 'pickrandom') {
            setSideboard(addCard(sideboard, target, pack[source.index]));
          } else if (stepQueue[0] === 'trash' || stepQueue[0] === 'trashrandom') {
            setTrashed([...trashed, pack[source.index]]);
          }

          makePick(source.index);
        }
      } else if (source.type === locations.deck) {
        if (target.type === locations.deck) {
          const [card, newCards] = removeCard(mainboard, source);
          setMainboard(addCard(newCards, target, card));
        } else if (target.type === locations.sideboard) {
          const [card, newCards] = removeCard(mainboard, source);
          setSideboard(addCard(sideboard, target, card));
          setMainboard(newCards);
        }
      } else if (source.type === locations.sideboard) {
        if (target.type === locations.deck) {
          const [card, newCards] = removeCard(sideboard, source);
          setMainboard(addCard(mainboard, target, card));
          setSideboard(newCards);
        } else if (target.type === locations.sideboard) {
          const [card, newCards] = removeCard(sideboard, source);
          setSideboard(addCard(newCards, target, card));
        }
      }
    },
    [stepQueue, makePick, mainboard, pack, trashed, onClickCard, dragStartTime, sideboard],
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
        onClickCard(Math.floor(Math.random() * pack.length));
      }, 1000);
    }
  }, [stepQueue, onClickCard, pack, loading]);

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
