import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Card } from 'components/base/Card';

import DeckStacks from 'components/DeckStacks';
import Pack from 'components/Pack';
import AutocardContext from 'contexts/AutocardContext';
import DraftLocation, { locations, addCard, removeCard } from 'drafting/DraftLocation';
import { draftStateToTitle, getCardCol, setupPicks } from 'drafting/draftutil';
import useMount from 'hooks/UseMount';
import { makeSubtitle } from 'utils/Card';
import { callApi } from 'utils/CSRF';
import Draft from 'datatypes/Draft';
import { Step } from 'datatypes/Draftbots';

interface CubeDraftProps {
  draft: Draft;
  socket: {
    on: (event: string, callback: (data: any) => void) => void;
    emit: (event: string, data: any) => void;
  };
}

const fetchPicks = async (draft: Draft, seat: number) => {
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

const fetchPack = async (draft: Draft, seat: number) => {
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
  const [packQueue, setPackQueue] = useState<any[]>([]);
  const [pack, setPack] = useState<number[]>([]);
  const [picks, setPicks] = useState<any[][][]>(setupPicks(2, 8));
  const [loading, setLoading] = useState(true);
  const [stepQueue, setStepQueue] = useState<Step[]>([]);
  const [trashed, setTrashed] = useState<number[]>([]);
  const { hideCard } = useContext(AutocardContext);

  const disabled = stepQueue[0].action === 'pickrandom' || stepQueue[0].action === 'trashrandom';

  staticPicks = picks;

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

      if (stepQueue[1].action === 'pass' || pack.length < 1) {
        tryPopPack();
      } else {
        const slice = stepQueue.slice(1, stepQueue.length);
        setStepQueue(slice);
        setPack(pack.filter((_, index) => index !== pick));
        setLoading(false);
      }

      await callApi('/multiplayer/draftpick', { draft: draft.id, seat, pick });
    },
    [hideCard, stepQueue, pack, draft.id, tryPopPack],
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
      seat = seatJson.seat;

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

      setPicks(await fetchPicks(draft, seat));
      updatePack(await fetchPack(draft, seat));
      setLoading(false);

      if (seat === 0) {
        delayedTryBotPicksLoop();
      }
    };
    run();
  });

  const onMoveCard = useCallback(
    async (source: DraftLocation, target: DraftLocation) => {
      if (source.equals(target)) {
        return;
      }

      if (source.type === locations.pack) {
        if (target.type === locations.picks) {
          if (stepQueue[0].action === 'pick' || stepQueue[0].action === 'pickrandom') {
            setPicks(addCard(picks, target, pack[source.index]));
          } else if (stepQueue[0].action === 'trash' || stepQueue[0].action === 'trashrandom') {
            setTrashed([...trashed, pack[source.index]]);
          }

          makePick(source.index);
        } else {
          console.error("Can't move cards inside pack.");
        }
      } else if (source.type === locations.picks) {
        if (target.type === locations.picks) {
          const [card, newCards] = removeCard(picks, source);
          setPicks(addCard(newCards, target, card));
        } else {
          console.error("Can't move cards from picks back to pack.");
        }
      }
    },
    [stepQueue, makePick, picks, pack, trashed],
  );

  const onClickCard = useCallback(
    (cardIndex: number) => {
      const col = getCardCol(draft, pack[cardIndex]);
      onMoveCard(DraftLocation.pack(cardIndex), DraftLocation.picks(0, col, picks[0][col].length));
    },
    [pack, onMoveCard, picks, draft],
  );

  useEffect(() => {
    if (
      (stepQueue[0].action === 'pickrandom' || stepQueue[0].action === 'trashrandom') &&
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
    <>
      <Pack
        pack={pack.map((index) => draft.cards[index])}
        onMoveCard={onMoveCard}
        onClickCard={onClickCard}
        loading={loading}
        title={draftStateToTitle(draft, picks, trashed, loading, stepQueue)}
        disabled={disabled}
      />
      <Card className="my-3">
        <DeckStacks
          cards={picks.map((row) => row.map((col) => col.map((index) => draft.cards[index])))}
          title="picks"
          subtitle={makeSubtitle(picks.flat(3).map((index) => draft.cards[index]))}
          locationType={locations.picks}
        />
      </Card>
    </>
  );
};

export default CubeDraft;
