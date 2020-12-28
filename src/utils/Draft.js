import { csrfFetch } from 'utils/CSRF';
import { getPickState, getScores } from 'utils/draftbots';

let draft = null;

export function init(newDraft) {
  draft = newDraft;
  console.log(draft);
}

function id() {
  return draft._id;
}

function cube() {
  return draft.cube;
}

function pack() {
  return (draft.seats[0].packbacklog[0] || []).map((cardId) => draft.cardList[cardId]);
}

function packPickNumber() {
  let picks = draft.seats[draft.seats.length - 1].pickorder.length;
  let packnum = 0;

  while (draft.initial_state[0][packnum] && picks >= draft.initial_state[0][packnum].length) {
    picks -= draft.initial_state[0][packnum].length;
    packnum += 1;
  }

  return [packnum + 1, picks + 1];
}

function arrangePicks(picks) {
  if (!Array.isArray(picks) || picks.length !== 16) {
    throw new Error('Picks must be an array of length 16.');
  }

  draft.seats[0].drafted = [...picks];
}

export const getPicked = (seat) => {
  return draft.seats[seat].pickorder;
};

function botPicks() {
  // make bots take one pick out of active packs
  for (let botIndex = 0; botIndex < draft.seats.length; botIndex++) {
    if (draft.seats[botIndex].bot) {
      const { cardsInPack, seen, picked } = getPickState(draft, botIndex);

      if (cardsInPack.length > 0) {
        const ratedPicks = getScores(draft.cardList, cardsInPack, picked, seen);

        const sortedPicks = ratedPicks.sort((a, b) => b.score - a.score);

        const pickedCard = draft.seats[botIndex].packbacklog[0].splice(sortedPicks[0].packIndex, 1)[0];
        draft.seats[botIndex].pickorder.push(pickedCard);
      }
    }
  }
}

function passPack() {
  botPicks();
  // check if pack is done
  if (draft.seats.every((seat) => seat.packbacklog[0].length === 0)) {
    // splice the first pack out
    for (const seat of draft.seats) {
      seat.packbacklog.splice(0, 1);
    }

    if (draft.unopenedPacks[0].length > 0) {
      // give new pack
      for (let i = 0; i < draft.seats.length; i++) {
        draft.seats[i].packbacklog.push(draft.unopenedPacks[i].shift());
      }
    }
  } else if (draft.unopenedPacks[0].length % 2 === 0) {
    // pass left
    for (let i = 0; i < draft.seats.length; i++) {
      draft.seats[(i + 1) % draft.seats.length].packbacklog.push(draft.seats[i].packbacklog.splice(0, 1)[0]);
    }
  } else {
    // pass right
    for (let i = draft.seats.length - 1; i >= 0; i--) {
      const packFrom = draft.seats[i].packbacklog.splice(0, 1)[0];
      if (i === 0) {
        draft.seats[draft.seats.length - 1].packbacklog.push(packFrom);
      } else {
        draft.seats[i - 1].packbacklog.push(packFrom);
      }
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pick(packIndex) {
  await sleep(0);
  const packFrom = draft.seats[0].packbacklog[0];
  const cardIndex = draft.seats[0].packbacklog[0].splice(packIndex, 1)[0];
  draft.seats[0].pickorder.push(cardIndex);
  passPack();
  const [packNum] = packPickNumber();
  csrfFetch(`/cube/api/draftpickcard/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify({
      draft_id: draft._id,
      pick: draft.cardList[cardIndex].details.name,
      pack: packFrom.map((c) => draft.cardList[c].details.name),
      packNum,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function finish() {
  // TODO: build bot decks, put into .drafted and .sideboards

  // save draft. if we fail, we fail
  console.log(draft);
  await csrfFetch(`/cube/api/submitdraft/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify(draft),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function allBotsDraft(noFinish) {
  for (const seat of draft.seats) {
    seat.bot = [];
  }
  while (draft.seats[0].packbacklog.length > 0 && draft.seats[0].packbacklog[0].length > 0) {
    passPack();
  }
  if (!noFinish) {
    await finish();
  }
}

export default {
  allBotsDraft,
  arrangePicks,
  cube,
  finish,
  id,
  init,
  pack,
  packPickNumber,
  pick,
};
