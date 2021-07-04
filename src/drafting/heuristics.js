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

const stddev = (list) => {
  const avg = average(list);

  const squareDiffs = list.map((value) => {
    const diff = value - avg;
    const sqrDiff = diff * diff;
    return sqrDiff;
  });

  const avgSquareDiff = average(squareDiffs);

  const stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
};

const overlap = (list1, list2) => {
  return list1.filter((item) => list2.includes(item));
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
  cardElo: ({ card, seen, picked }) => {
    // overall strength of card, normalized for what we have seen
    let lowest = cardContext[idToOracle[card]].elo;
    let highest = cardContext[idToOracle[card]].elo;

    for (const list of [seen, picked]) {
      for (const item of list) {
        if (cardContext[idToOracle[item]].elo > highest) {
          highest = cardContext[idToOracle[item]].elo;
        }
        if (cardContext[idToOracle[item]].elo < lowest) {
          lowest = cardContext[idToOracle[item]].elo;
        }
      }
    }

    return (cardContext[idToOracle[card]].elo - lowest) / (highest - lowest);
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
      if (idToOracle[card] !== idToOracle[id]) {
        synergies.push(getSynergy(idToOracle[card], idToOracle[id]));
      }
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

    return (
      picked.filter((id) => cardContext[idToOracle[id]].type.toLowerCase().includes('creature')).length / picked.length
    );
  },
  noncreatureCount: ({ card, picked }) => {
    // % of pool that is non-creatures, or 0 if this card is a creature
    if (cardContext[idToOracle[card]].type.toLowerCase().includes('creature')) {
      return 0;
    }
    if (picked.length === 0) {
      return 1;
    }

    return (
      picked.filter((id) => !cardContext[idToOracle[id]].type.toLowerCase().includes('creature')).length / picked.length
    );
  },
  producesCount: ({ card }) => {
    // number of colors of mana this card produces
    return cardContext[idToOracle[card]].produced_mana.length;
  },
  pipDensity: ({ card, picked }) => {
    // % of pips in picked cards' costs that can be paid for with this card
    const produces = cardContext[idToOracle[card]].produced_mana;
    const pips = {
      W: 0,
      U: 0,
      B: 0,
      R: 0,
      G: 0,
    };

    for (const id of picked) {
      for (const pip of cardContext[idToOracle[id]].parsed_cost) {
        if (pips[pip.toUpperCase()] || pips[pip.toUpperCase()] === 0) {
          pips[pip.toUpperCase()] += 1;
        }
      }
    }

    // eslint-disable-next-line no-unused-vars
    const totalPips = sum(Object.entries(pips).map(([key, value]) => value));
    const producedPips = sum(
      Object.entries(pips)
        // eslint-disable-next-line no-unused-vars
        .filter(([key, value]) => produces.includes(key))
        // eslint-disable-next-line no-unused-vars
        .map(([key, value]) => value),
    );

    if (totalPips === 0) {
      return 0;
    }

    return producedPips / totalPips;
  },
  fixingOverlap: ({ card, picked }) => {
    // % of cards picked that produce mana that this card also produces
    if (picked.length === 0) {
      return 0;
    }
    const produces = cardContext[idToOracle[card]].produced_mana;

    return (
      picked.filter((id) => overlap(produces, cardContext[idToOracle[id]].produced_mana).length > 0).length /
      picked.length
    );
  },
  manaValue: ({ card }) => {
    // mana value of this card
    return cardContext[idToOracle[card]].cmc;
  },
  pickedManaValueAverage: ({ picked }) => {
    // average mana value of cards picked
    if (picked.length === 0) {
      return 0;
    }

    return average(picked.map((card) => cardContext[idToOracle[card]].cmc));
  },
  pickedManaDeviation: ({ picked }) => {
    // std.dev of mana value of cards picked
    if (picked.length === 0) {
      return 0;
    }

    return stddev(picked.map((card) => cardContext[idToOracle[card]].cmc));
  },
  colorOverlap: ({ card, picked }) => {
    // % of picked cards that share a color with this card
    if (picked.length === 0) {
      return 0;
    }
    const { color_identity } = cardContext[idToOracle[card]];

    return (
      picked.filter((id) => overlap(color_identity, cardContext[idToOracle[id]].color_identity).length > 0).length /
      picked.length
    );
  },
  castability: ({ card, picked }) => {
    // % of picked cards that produce mana that could pay for this card
    if (picked.length === 0) {
      return 0;
    }
    const cost = cardContext[idToOracle[card]].parsed_cost.map((c) => c.toUpperCase());

    return (
      picked.filter((id) => overlap(cost, cardContext[idToOracle[id]].produced_mana).length > 0).length / picked.length
    );
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
  return mapEntries(heuristics, ([name, func]) => [name, func(params)]);
};
