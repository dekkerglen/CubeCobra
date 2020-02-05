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

export function botRating(ratings, botColors, card) {
  let rating = ratings[card.details.name] || 1200;
  const colors = card.colors || card.details.color_identity;
  const subset = arrayIsSubset(colors, botColors) && colors.length > 0;
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line || card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = fetchLands.includes(card.details.name);

  if (isLand) {
    if (subset) {
      // if fetches don't have the color identity override, they get lumped into this category
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
  for (let botIndex = 1; botIndex < draft.packs.length; botIndex++) {
    const botPack = draft.packs[botIndex][0];
    const botColors = draft.bots[botIndex - 1];
    const ratedPicks = [];
    const unratedPicks = [];
    for (let cardIndex = 0; cardIndex < botPack.length; cardIndex++) {
      if (draft.ratings[botPack[cardIndex].details.name]) {
        ratedPicks.push(cardIndex);
      } else {
        unratedPicks.push(cardIndex);
      }
    }

    // eslint-disable-next-line no-loop-func
    ratedPicks.sort((x, y) =>
      botRating(draft.ratings, botColors, botPack[x]) - botRating(draft.ratings, botColors, botPack[y])
    );
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
      picks: [card.details.name],
      pack: currentPack.map((c) => c.details.name),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function removeDetails(arr) {
  const result = [...arr];
  for (let i = 0; i < result.length; i++) {
    if (Array.isArray(result[i])) {
      result[i] = removeDetails(result[i]);
    } else {
      delete result.details;
    }
  }
}

export async function saveDraft(currentDraft) {
  const temp = JSON.parse(JSON.stringify(currentDraft));
  temp.packs = removeDetails(temp.packs);
  temp.picks = removeDetails(temp.picks);
  // save draft. if we fail, we fail
  const response = await csrfFetch(`/cube/api/savedraft/${currentDraft.cube}`, {
    method: 'POST',
    body: JSON.stringify(temp),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error('Saving draft failed.');
  }
}

async function finish() {
  await saveDraft(draft);
  const form = document.getElementById('submitDeckForm');
  if (form) {
    form.submit();
  }
}

function subtitle(cards) {
  const numCards = cards.length;
  const allTypes = cards.map((card) => (card.type_line || card.details.type).toLowerCase());
  const numLands = allTypes.filter((type) => type.includes('land')).length;
  const numNonlands = allTypes.filter(
    (type) => !type.includes('land') && !/^(plane|phenomenon|vanguard|scheme|conspiracy)$/.test(type),
  ).length;
  const numCreatures = allTypes.filter((type) => type.includes('creature')).length;
  const numNonCreatures = numNonlands - numCreatures;
  return (
    `${numCards} card${numCards === 1 ? '' : 's'}: ` +
    `${numLands} land${numLands === 1 ? '' : 's'}, ` +
    `${numNonlands} nonland: ` +
    `${numCreatures} creature${numCreatures === 1 ? '' : 's'}, ` +
    `${numNonCreatures} noncreature${numNonCreatures === 1 ? '' : 's'}`
  );
}

export default { init, id, cube, pack, packPickNumber, arrangePicks, pick, saveDraft, finish, subtitle };
