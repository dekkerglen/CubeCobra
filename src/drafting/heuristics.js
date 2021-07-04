import { fromEntries } from 'utils/Util';

const cardContext = {};
const idToOracle = {};

function mapEntries(object, func) {
  return fromEntries(Object.entries(object).map(func));
}

const sum = (list) => {
  let s = 0;
  for (const item of list) {
    s += item;
  }
  return s;
};

const max = (list) => {
  let m = list[0];
  for (const item of list) {
    if (item > m) {
      m = item;
    }
  }
  return m;
};

const average = (list) => {
  return sum(list) / list.length;
};

const getSynergy = (oracle1, oracle2) => {
  const em1 = cardContext[oracle1].embedding;
  const em2 = cardContext[oracle2].embedding;
  if (oracle1 === oracle2) {
    return 1;
  }

  let sim = 0;
  if (em1 && em2 && em1.length === em2.length) {
    for (let i = 0; i < 64; i++) {
      sim += em1[i] * em2[i];
    }
  }
  return sim;
};

const heuristics = {
  draftProgression: ({ picked }) => {
    // how for along the draft is
    return picked.length / 45;
  },
  cardElo: ({ card }) => {
    // overall strength of card
    return cardContext[idToOracle[card]].elo;
  },
  averagePickedSynergy: ({ card, picked }) => {
    // average synergy of card with all cards picked
    if (picked.length === 0) {
      return 1;
    }

    const synergies = [];
    for (const id of picked) {
      synergies.push(getSynergy(idToOracle[card], idToOracle[id]));
    }
    return average(synergies);
  },
  maxPickedSynergy: ({ card, picked }) => {
    // max synergy of card with all cards picked
    if (picked.length === 0) {
      return 1;
    }

    const synergies = [];
    for (const id of picked) {
      synergies.push(getSynergy(idToOracle[card], idToOracle[id]));
    }
    return max(synergies);
  },
  averageSeenSynergy: ({ card, seen }) => {
    // average synergy of card with all cards seen
    if (seen.length === 0) {
      return 1;
    }

    const synergies = [];
    for (const id of seen) {
      synergies.push(getSynergy(idToOracle[card], idToOracle[id]));
    }
    return average(synergies);
  },
  maxSeenSynergy: ({ card, seen }) => {
    // max synergy of card with all cards seen
    if (seen.length === 0) {
      return 1;
    }

    const synergies = [];
    for (const id of seen) {
      synergies.push(getSynergy(idToOracle[card], idToOracle[id]));
    }
    return max(synergies);
  },
  creatureCount: ({ card, picked }) => {
    // % of pool that is creatures, or 0 if this card is not a creature
    if (!cardContext[idToOracle[card]].type.toLowerCase().includes('creature')) {
      return 0;
    }
    if (picked.length === 0) {
      return 1;
    }

    return picked.filter((id) => cardContext[idToOracle[id]].type.toLowerCase().includes('creature')) / picked.length;
  },
  noncreatureCount: ({ card, picked }) => {
    // % of pool that is non-creatures, or 0 if this card is a creature
    if (cardContext[idToOracle[card]].type.toLowerCase().includes('creature')) {
      return 0;
    }
    if (picked.length === 0) {
      return 1;
    }

    return picked.filter((id) => !cardContext[idToOracle[id]].type.toLowerCase().includes('creature')) / picked.length;
  },
  pipDensity: () => {
    // % of pips in picked cards' costs that can be paid for with this card
    return 0;
  },
  fixingOverlap: () => {
    // % of cards picked that produce mana that this card also produces
    return 0;
  },
  manaValue: () => {
    // mana value of this card
    return 0;
  },
  pickedManaValueAverage: () => {
    // average mana value of cards picked
    return 0;
  },
  pickedManaDeviation: () => {
    // std.dev of mana value of cards picked
    return 0;
  },
  colorOverlap: () => {
    // % of picked cards that share a color with this card
    return 0;
  },
  castability: () => {
    // % of picked cards that produce mana that could pay for this card
    return 0;
  },
  colorOpenness: () => {
    // how open this color is
    // for each card seen, take the elo, and add it to that color
    // then the openness for a color, is the sum of elo in that color divided by the highest openness
    // most open color will always be 1
    return 0;
  },
};

export const addCardContext = (cards) => {
  for (const card of cards) {
    if (!idToOracle[card.details._id]) {
      idToOracle[card.details._id] = card.details.oracle_id;
    }
    if (!cardContext[card.details.oracle_id]) {
      cardContext[card.details.oracle_id] = card.details;
    }
  }
};

// params = {
//  card: id,
//  picked: [id],
//  seen: [id]
// }
export const scores = (params) => {
  console.log(params);
  return mapEntries(heuristics, ([name, func]) => [name, func(params)]);
};
