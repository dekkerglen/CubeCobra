import React from 'react';
import PropTypes from 'prop-types';
import DraftPropType from 'proptypes/DraftPropType';
import useMount from 'hooks/UseMount';
import Pack from 'components/Pack';
import DndProvider from 'components/DndProvider';
import DeckStacks from 'components/DeckStacks';
import { makeSubtitle } from 'utils/Card';
import DraftLocation, { moveOrAddCard } from 'drafting/DraftLocation';
import { setupPicks, getCardCol, getDrafterState } from 'drafting/draftutil';

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

const actionToString = {
  pick: 'Pick One Card',
  trash: 'Trash One Card',
  pickrandom: 'Picking one card at random...',
  trashrandom: 'Trashing one card at random...',
};

let staticPicks;

let seat = 0;

const CubeDraft = ({ draft, socket }) => {
  const [pack, setPack] = React.useState([]);
  const [picks, setPicks] = React.useState(setupPicks(2, 8));
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('Waiting for cards...');

  staticPicks = picks;

  const updatePack = (data) => {
    setPack(data);

    const cardsPicked = staticPicks
      .map((row) => row.map((col) => col.length).reduce((a, b) => a + b, 0))
      .reduce((a, b) => a + b, 0);

    const drafterState = getDrafterState(draft, seat, cardsPicked);

    setTitle(`Pack ${drafterState.pack} Pick ${drafterState.pick}: ${actionToString[drafterState.action]}`);
  };

  useMount(() => {
    const run = async () => {
      const getSeat = await callApi('/multiplayer/getseat', { draftid: draft._id });
      const seatJson = await getSeat.json();
      seat = seatJson.seat;

      console.log({ draft, seat });

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
        updatePack(data);
        setLoading(false);
      });

      setPicks(await fetchPicks(draft, seat));
      updatePack(await fetchPack(draft, seat));
      setLoading(false);
    };
    run();
  });

  const makePick = async (pick) => {
    // eslint-disable-next-line no-undef
    /* global */ autocard_hide_card();
    setLoading(true);
    setTitle('Waiting for cards...');
    await callApi('/multiplayer/draftpick', { draft: draft._id, seat, pick });
  };

  const onMoveCard = async (source, target) => {
    if (source.equals(target)) {
      return;
    }
    if (source.type === DraftLocation.PACK) {
      if (target.type === DraftLocation.PICKS) {
        setPicks(moveOrAddCard(picks, target.data, pack[source.data]));
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
  };

  const onClickCard = (cardIndex) => {
    const col = getCardCol(draft, pack[cardIndex]);
    onMoveCard(
      new DraftLocation(DraftLocation.PACK, cardIndex),
      new DraftLocation(DraftLocation.PICKS, [0, col, picks[0][col].length]),
    );
  };

  return (
    <DndProvider>
      <Pack
        pack={pack.map((index) => draft.cards[index])}
        onMoveCard={onMoveCard}
        onClickCard={onClickCard}
        loading={loading}
        title={title}
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
