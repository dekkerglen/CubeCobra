import React from 'react';
import PropTypes from 'prop-types';
import DraftPropType from 'proptypes/DraftPropType';
import useMount from 'hooks/UseMount';
import Pack from 'components/Pack';
import DndProvider from 'components/DndProvider';
import DeckStacks from 'components/DeckStacks';
import { makeSubtitle, cardCmc } from 'utils/Card';
import DraftLocation, { moveOrAddCard } from 'drafting/DraftLocation';

import { callApi } from 'utils/CSRF';

import { Card } from 'reactstrap';

const setupPicks = (rows, cols) => {
  const res = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      row.push([]);
    }
    res.push(row);
  }
  return res;
};

const getCardCol = (draft, cardIndex) => Math.min(7, cardCmc(draft.cards[cardIndex]));

const fetchPicks = async (draft, seat) => {
  const res = await callApi('/multiplayer/getpicks', {
    draft: draft._id,
    seat,
  });
  const json = await res.json();
  const picks = setupPicks(1, 8);

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

const CubeDraft = ({ draft, seat, socket }) => {
  const [pack, setPack] = React.useState([]);
  const [picks, setPicks] = React.useState(setupPicks(1, 8));
  const [loading, setLoading] = React.useState(true);

  useMount(() => {
    const run = async () => {
      socket.on('message', (data) => {
        console.log(data);
      });
      socket.on('pack', (data) => {
        setPack(data);
        setLoading(false);
      });

      setPack(await fetchPack(draft, seat));
      setPicks(await fetchPicks(draft, seat));
      setLoading(false);
    };
    run();
  });

  const makePick = async (pick) => {
    // eslint-disable-next-line no-undef
    /* global */ autocard_hide_card();
    setLoading(true);
    await callApi('/multiplayer/draftpick', { draft: draft._id, seat, pick });
  };

  const start = async () => {
    await callApi('/multiplayer/startdraft', {
      draft: draft._id,
      seat,
    });
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
        setPicks(moveOrAddCard(picks, target.data, pack[source.data]));
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
  seat: PropTypes.number.isRequired,
  draft: DraftPropType.isRequired,
  socket: PropTypes.shape({
    on: PropTypes.func.isRequired,
  }).isRequired,
};

export default CubeDraft;
