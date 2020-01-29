import { csrfFetch } from './CSRF';
import { arrayIsSubset, arrayShuffle } from './Util';

let draft = null;

function init(newDraft) {
  draft = newDraft;
}

function id() {
  return draft._id;
}

function cube() {
  return draft.cube;
}

function pack() {
  return draft.seats[0].packbacklog[0] || [];
}

function packPickNumber() {
  let picks = draft.seats[0].length;
  let picknum = 1;
  let packnum = 1;
  while (picks > draft.initial_state[packnum - 1].length) {
    picks -= draft.initial_state[packnum - 1].length;
    packnum++;
  }
  return [packnum, picknum];
}

function arrangePicks(picks) {
  if (!Array.isArray(picks) || picks.length !== 16) {
    throw new Error('Picks must be an array of length 16.');
  }

  draft.seats[0].drafted = [...picks];
}

const fetchLands = [
  'Arid Mesa',
  'Bloodstained Mire',
  'Flooded Strand',
  'Marsh Flats',
  'Misty Rainforest',
  'Polluted Delta',
  'Scalding Tarn',
  'Verdant Catacombs',
  'Windswept Heath',
  'Wooded Foothills',
];

function botRating(botColors, card) {
  let rating = draft.ratings[card.details.name];
  const colors = card.colors || card.details.color_identity;
  const subset = arrayIsSubset(colors, botColors) && colors.length > 0;
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line || card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = fetchLands.includes(card.details.name);

  if (isLand) {
    if (subset) {
      //if fetches don't have the color identity override, they get lumped into this category
      rating *= 1.4;
    } else if (overlap || isFetch) {
      rating *= 1.2;
    } else {
      rating *= 1.1;
    }
  } else if (subset) {
    rating *= 1.3;
  } else if (overlap) {
    rating *= 1.1;
  }

  return rating;
}

function botPicks() {
  // make bots take one pick out of active packs
  for (let botIndex = 1; botIndex < draft.seats.length; botIndex++) {
    const pack = draft.seats[botIndex].packbacklog[0];
    const botColors = draft.seats[botIndex].bot;
    const ratedPicks = [];
    const unratedPicks = [];
    for (let cardIndex = 0; cardIndex < pack.length; cardIndex++) {
      if (draft.ratings && draft.ratings[pack[cardIndex].details.name]) {
        ratedPicks.push(cardIndex);
      } else {
        unratedPicks.push(cardIndex);
      }
    }

    ratedPicks.sort((x, y) => {
      return botRating(botColors, pack[y]) - botRating(botColors, pack[x]);
    });
    arrayShuffle(unratedPicks);

    const pickOrder = ratedPicks.concat(unratedPicks);
    pick = draft.seats[botIndex].packbacklog[0].splice(pickOrder[0], 1)[0];
    draft.seats[botIndex].pickorder.push(pick.cardID);
  }
}

function passPack() {
  console.log(draft);
  botPicks();
  //check if pack is done
  if (draft.seats.every((seat) => seat.packbacklog[0].length === 0)) {
    //splice the first pack out
    for (const seat of draft.seats) {
      seat.packbacklog.splice(0, 1)[0];
    }

    if (draft.unopenedPacks[0].length > 0) {
      //give new pack
      for (let i = 0; i < draft.seats.length; i++) {
        draft.seats[i].packbacklog.push(draft.unopenedPacks[i].splice(0, 1)[0]);
      }
    }
  } else {
    if (draft.unopenedPacks[0].length % 2 == 0) {
      //pass left
      for (let i = 0; i < draft.seats.length; i++) {
        const pack = draft.seats[i].packbacklog.splice(0, 1)[0];
        draft.seats[(i + 1) % draft.seats.length].packbacklog.push(pack);
      }
    } else {
      //pass right
      for (let i = draft.seats.length - 1; i >= 0; i--) {
        const pack = draft.seats[i].packbacklog.splice(0, 1)[0];
        if (i == 0) {
          draft.seats[draft.seats.length - 1].packbacklog.push(pack);
        } else {
          draft.seats[i - 1].packbacklog.push(pack);
        }
      }
    }
  }
}

async function pick(cardIndex) {
  const card = draft.seats[0].packbacklog[0].splice(cardIndex, 1)[0];
  const pack = draft.seats[0].packbacklog[0];
  draft.seats[0].pickorder.push(card.cardID);
  passPack();
  await csrfFetch('/cube/api/draftpickcard/' + draft.cube, {
    method: 'POST',
    body: JSON.stringify({
      draft_id: draft._id,
      pick: card.details.name,
      pack: pack.map((c) => c.details.name),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function finish() {
  const temp = JSON.parse(JSON.stringify(draft));
  //save draft. if we fail, we fail
  await csrfFetch('/cube/api/draftpick/' + draft.cube, {
    method: 'POST',
    body: JSON.stringify(temp),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export default { init, id, cube, pack, packPickNumber, arrangePicks, pick, finish };
