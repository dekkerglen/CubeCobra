import { csrfFetch } from 'utils/CSRF';
import { arrayIsSubset, arrayRotate, arrayShuffle } from 'utils/Util';

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
  return draft.packs[0][0] || [];
}

function packPickNumber() {
  return [draft.packNumber, draft.pickNumber];
}

function arrangePicks(picks) {
  if (!Array.isArray(picks) || picks.length !== 16) {
    throw new Error('Picks must be an array of length 16.');
  }

  draft.picks[0] = [...picks];
}

const fetchLands = {
  'Arid Mesa': ['W', 'R'],
  'Bloodstained Mire': ['B', 'R'],
  'Flooded Strand': ['W', 'U'],
  'Marsh Flats': ['W', 'B'],
  'Misty Rainforest': ['U', 'G'],
  'Polluted Delta': ['U', 'B'],
  'Scalding Tarn': ['U', 'R'],
  'Verdant Catacombs': ['B', 'G'],
  'Windswept Heath': ['W', 'G'],
  'Wooded Foothills': ['R', 'G'],
};

function botRating(botColors, card) {
  let rating = draft.ratings[card.details.name];
  const colors = fetchLands[card.details.name] || card.colors || card.details.color_identity;
  const colorless = colors.length === 0;
  const subset = arrayIsSubset(colors, botColors) && !colorless;
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line || card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[card.details.name];

  if (isLand) {
    if (subset || (overlap && isFetch)) {
      // For an average-ish Elo of 1300, this boosts by 260 points.
      rating *= 1.2;
    } else if (overlap) {
      rating *= 1.1;
    }
  } else if (subset || colorless) {
    rating *= 1.15;
  } else if (overlap) {
    rating *= 1.05;
  }

  return rating;
}

function botPicks() {
  // make bots take one pick out of active packs
  for (let botIndex = 1; botIndex < draft.packs.length; botIndex++) {
    const botPack = draft.packs[botIndex][0];
    const botColors = draft.bots[botIndex - 1];
    const ratedPicks = [];
    const unratedPicks = [];
    for (let cardIndex = 0; cardIndex < botPack.length; cardIndex++) {
      if (draft.ratings && draft.ratings[botPack[cardIndex].details.name]) {
        ratedPicks.push(cardIndex);
      } else {
        unratedPicks.push(cardIndex);
      }
    }

    ratedPicks.sort((x, y) => {
      return botRating(botColors, botPack[y]) - botRating(botColors, botPack[x]);
    });
    arrayShuffle(unratedPicks);

    const pickOrder = ratedPicks.concat(unratedPicks);
    const [botPick] = botPack.splice(pickOrder[0], 1);
    draft.picks[botIndex].push(botPick.cardID);
  }
}

function passPack() {
  draft.pickNumber += 1;
  botPicks();
  // check if pack is done
  if (draft.packs.every((seat) => seat[0].length === 0)) {
    draft.packNumber += 1;
    draft.pickNumber = 1;
    // splice the first pack out
    for (const drafter of draft.packs) {
      drafter.splice(0, 1);
    }
  } else {
    // eslint-disable-next-line no-lonely-if
    if (draft.packs[0].length % 2 === 0) {
      // pass left
      arrayRotate(draft.packs, false);
    } else {
      // pass right
      arrayRotate(draft.packs, true);
    }
  }
}

async function pick(cardIndex) {
  const [card] = draft.packs[0][0].splice(cardIndex, 1);
  const currentPack = draft.packs[0][0];
  draft.pickOrder.push(card.cardID);
  passPack();
  await csrfFetch(`/cube/api/draftpickcard/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify({
      draft_id: draft._id,
      pick: card.details.name,
      pack: currentPack.map((c) => c.details.name),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function finish() {
  const temp = JSON.parse(JSON.stringify(draft));
  for (const seat of temp.packs) {
    for (const seatPack of seat) {
      for (const card of seatPack) {
        delete card.details;
      }
    }
  }
  for (const picks of temp.picks) {
    if (Array.isArray(picks)) {
      for (const card of picks) {
        if (card) {
          delete card.details;
        }
      }
    } else {
      delete picks.details;
    }
  }
  // save draft. if we fail, we fail
  await csrfFetch(`/cube/api/draftpick/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify(temp),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export default { init, id, cube, pack, packPickNumber, arrangePicks, pick, finish };
