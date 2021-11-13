import React, { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import DraftPropType from 'proptypes/DraftPropType';
import useMount from 'hooks/UseMount';
import Pack from 'components/Pack';
import DndProvider from 'components/DndProvider';
import DeckStacks from 'components/DeckStacks';
import { makeSubtitle } from 'utils/Card';
import DraftLocation, { moveOrAddCard } from 'drafting/DraftLocation';
import { setupPicks, getCardCol, getDrafterState, stepToTitle, nextStep } from 'drafting/draftutil';

import { callApi } from 'utils/CSRF';

import { Card } from 'reactstrap';

const fetchPicks = async (draft, seat) => {
  const res = await callApi('/multiplayer/getpicks', {
    draft: draft._id,
    seat,
  });
  const json = await res.json();
  const picks = setupPicks(2, 8);

  for (const index of json.picks) {
    picks[0][getCardCol(draft, index)].push(index);
  }

  return picks;
};

const fetchPack = async (draft, seat) => {
  const res = await callApi('/multiplayer/getpack', {
    draft: draft._id,
    seat,
  });
  const json = await res.json();
  return json.pack;
};

let staticPicks;

let seat = 0;

const CubeDraft = ({ draft, socket }) => {
  const [pack, setPack] = React.useState([]);
  const [picks, setPicks] = React.useState(setupPicks(2, 8));
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('Waiting for cards...');
  const [action, setAction] = React.useState(null);

  const disabled = action === 'pickrandom' || action === 'trashrandom';

  staticPicks = picks;

  const currentDrafterState = useCallback(() => {
    const cardsPicked = staticPicks
      .map((row) => row.map((col) => col.length).reduce((a, b) => a + b, 0))
      .reduce((a, b) => a + b, 0);

    return getDrafterState(draft, seat, cardsPicked);
  }, [draft]);

  const getNextStep = useCallback(() => {
    const cardsPicked = staticPicks
      .map((row) => row.map((col) => col.length).reduce((a, b) => a + b, 0))
      .reduce((a, b) => a + b, 0);

    return nextStep(draft, seat, cardsPicked + 1);
  }, [draft]);

  const makePick = useCallback(
    async (pick) => {
      // eslint-disable-next-line no-undef
      /* global */ autocard_hide_card();

      if (getNextStep() === 'pass') {
        setLoading(true);
      } else {
        setPack(pack.filter((_, index) => index !== pick));
      }

      setTitle('Waiting for cards...');
      await callApi('/multiplayer/draftpick', { draft: draft._id, seat, pick });
    },
    [draft, setLoading, setTitle, setPack, pack, getNextStep],
  );

  const updatePack = async (data) => {
    setPack(data);

    const drafterState = currentDrafterState();

    setAction(drafterState.step.action);
    setTitle(`Pack ${drafterState.pack} Pick ${drafterState.pick}: ${stepToTitle(drafterState.step)}`);
  };

  useMount(() => {
    const run = async () => {
      const getSeat = await callApi('/multiplayer/getseat', { draftid: draft._id });
      const seatJson = await getSeat.json();
      seat = seatJson.seat;

      socket.emit('joinDraft', { draftId: draft._id, seat });

      socket.on('draft', async (data) => {
        if (data.finished === 'true') {
          const res = await callApi('/multiplayer/editdeckbydraft', {
            draftId: draft._id,
            seat,
            drafted: staticPicks,
            sideboard: setupPicks(1, 8),
          });
          const json = await res.json();

          window.location.href = `/cube/deck/deckbuilder/${json.deck}`;
        }
      });
      socket.on('seat', (data) => {
        console.log(data);
        updatePack(data);
        setLoading(false);
      });

      setPicks(await fetchPicks(draft, seat));
      updatePack(await fetchPack(draft, seat));
      setLoading(false);
    };
    run();
  });

  const onMoveCard = useCallback(
    async (source, target) => {
      if (source.equals(target)) {
        return;
      }

      if (source.type === DraftLocation.PACK) {
        if (target.type === DraftLocation.PICKS) {
          const drafterState = currentDrafterState();

          if (drafterState.step.action === 'pick' || drafterState.step.action === 'pickrandom') {
            setPicks(moveOrAddCard(picks, target.data, pack[source.data]));
          }

          makePick(source.data);
        } else {
          console.error("Can't move cards inside pack.");
        }
      } else if (source.type === DraftLocation.PICKS) {
        if (target.type === DraftLocation.PICKS) {
          setPicks(moveOrAddCard(picks, target.data, source.data));
        } else {
          console.error("Can't move cards from picks back to pack.");
        }
      }
    },
    [pack, picks, makePick],
  );

  const onClickCard = useCallback(
    (cardIndex) => {
      const col = getCardCol(draft, pack[cardIndex]);
      onMoveCard(
        new DraftLocation(DraftLocation.PACK, cardIndex),
        new DraftLocation(DraftLocation.PICKS, [0, col, picks[0][col].length]),
      );
    },
    [pack, onMoveCard, picks, draft],
  );

  useEffect(() => {
    if ((action === 'pickrandom' || action === 'trashrandom') && pack.length > 0 && !loading) {
      setLoading(true);
      onClickCard(Math.floor(Math.random() * pack.length));
    }
  }, [action, onClickCard, pack, loading]);

  return (
    <DndProvider>
      <Pack
        pack={pack.map((index) => draft.cards[index])}
        onMoveCard={onMoveCard}
        onClickCard={onClickCard}
        loading={loading}
        title={title}
        disabled={disabled}
      />
      <Card className="my-3">
        <DeckStacks
          cards={picks.map((row) => row.map((col) => col.map((index) => draft.cards[index])))}
          title="Picks"
          subtitle={makeSubtitle(picks.flat(3).map((index) => draft.cards[index]))}
          locationType={DraftLocation.PICKS}
          canDrop={(_, to) => to.type === DraftLocation.PICKS}
          onMoveCard={onMoveCard}
        />
      </Card>
    </DndProvider>
  );
};

CubeDraft.propTypes = {
  draft: DraftPropType.isRequired,
  socket: PropTypes.shape({
    on: PropTypes.func.isRequired,
    emit: PropTypes.func.isRequired,
  }).isRequired,
};

export default CubeDraft;
