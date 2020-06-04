import similarity from 'compute-cosine-similarity';

import { csrfFetch } from 'utils/CSRF';
import { arrayIsSubset, arrayShuffle, fromEntries } from 'utils/Util';
import { COLOR_COMBINATIONS } from 'utils/Card';

let draft = null;

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
  'Prismatic Vista': ['W', 'U', 'B', 'R', 'G'],
  'Fabled Passage': ['W', 'U', 'B', 'R', 'G'],
};

function botCardRating(botColors, card) {
  let { rating } = card;
  const colors = fetchLands[card.details.name] ?? card.colors ?? card.details.color_identity;
  const colorless = colors.length === 0;
  const subset = arrayIsSubset(colors, botColors) && !colorless;
  const contains = arrayIsSubset(botColors, colors);
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line ?? card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[card.details.name];

  // If you add x to a rating you roughly increase the estimated value
  // of picking it by a factor of (100 * 10**(x/400)) - 100 percent
  if (isLand) {
    if ((subset || contains) && isFetch) {
      rating += 280; // Increase value of picking by roughly 400%
    } else if (subset || contains) {
      switch (colors.length) {
        case 1:
          rating += 191; // Increase value of picking by roughly 200%
          break;
        case 2:
          rating += 262; // Increase value of picking by roughly 350%
          break;
        default:
          rating += 311; // Increase value of picking by roughly 500%
          break;
      }
    } else if (overlap && isFetch) {
      rating += 241; // Increase value of picking by roughly 300%
    } else if (overlap || colorless) {
      rating += 159; // Increase value of picking by roughly 150%
    }
  } else if (colorless) {
    rating += 205; // Increase value of picking by roughly 225%
  } else if (subset) {
    rating += 191; // Increase value of picking by roughly 200%
  } else if (contains) {
    rating += 141; // Increase value of picking by roughly 125%
  } else if (overlap) {
    rating += 70; // Increase value of picking by roughly 50%
  }

  return rating;
}

const toValue = (elo) => 10 ** (elo / 400);

function addSeen(seen, cards) {
  for (const card of cards) {
    const colors = card.colors ?? card.details.colors ?? [];
    // We ignore colorless because they just reduce variance by
    // being in all color combinations.
    if (colors.length > 0) {
      for (const comb of COLOR_COMBINATIONS) {
        if (arrayIsSubset(colors, comb)) {
          seen[comb.join('')] += card.rating ? toValue(botCardRating(comb, card, card)) : 0;
        }
      }
    }
    seen.cards.push(card);
  }
}

function init(newDraft) {
  draft = newDraft;
  for (const seat of draft.seats) {
    seat.seen = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
    seat.seen.cards = [];
    addSeen(seat.seen, seat.packbacklog[0].slice());
    seat.picked = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
    seat.picked.cards = [];
  }
  draft.overallPool = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
  draft.overallPool.cards = [];
  addSeen(draft.overallPool, draft.unopenedPacks.flat(3));
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

const considerInCombination = (combination) => (card) =>
  card && arrayIsSubset(card.colors ?? card.details.color_identity ?? card.details.colors ?? [], combination);

const findBestValueArray = (weights, pickNumPercent) => {
  const index = weights.length * pickNumPercent;
  const ceilIndex = Math.ceil(index);
  const floorIndex = Math.floor(index);
  // Is an integer or is past the end by less than 1
  if (index === floorIndex || ceilIndex === weights.length) {
    return weights[floorIndex];
  }
  // The fractional part of index.
  const indexModOne = index - floorIndex;
  // If is fractional and not past the end we weight it by the two
  // closest points by how close it is to that point.
  return indexModOne * weights[ceilIndex] + (1 - indexModOne) * weights[floorIndex];
};

const findBestValue2d = (weights, packNum, pickNum, initialState) => {
  const packNumPercent = (packNum - 1) / initialState[0].length;
  const pickNumPercent = (pickNum - 1) / initialState[0][packNum - 1].length;
  const index = weights.length * packNumPercent;
  const ceilIndex = Math.ceil(index);
  const floorIndex = Math.floor(index);
  // Is either an integer or is past the end by less than 1 so we can use floor as our index
  if (index === floorIndex || ceilIndex === weights.length) {
    return findBestValueArray(weights[floorIndex], pickNumPercent);
  }
  // The fractional part of index.
  const indexModOne = index - floorIndex;
  // If is fractional and not past the end we weight it by the two
  // closest points by how close it is to that point.
  return (
    indexModOne * findBestValueArray(weights[ceilIndex], pickNumPercent) +
    (1 - indexModOne) * findBestValueArray(weights[floorIndex], pickNumPercent)
  );
};

// We want to discourage playing more colors so they get less
// value the more colors, this gets offset by having more cards.
const COLOR_SCALING_FACTOR = [1, 1, 0.6, 0.3, 0.1, 0.07];
const COLORS_WEIGHTS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
const VALUE_WEIGHTS = [
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];
const INTERNAL_SYNERGY_WEIGHTS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
const SYNERGY_WEIGHTS = [
  [1 / 12, 1 / 6, 1 / 4, 1 / 3, 5 / 12, 1 / 2, 7 / 12, 2 / 3, 3 / 4, 5 / 6, 11 / 12, 1, 13 / 12, 7 / 6, 5 / 4],
  [4 / 3, 17 / 12, 3 / 2, 19 / 12, 5 / 3, 7 / 4, 11 / 6, 23 / 12, 2, 25 / 12, 13 / 6, 9 / 4, 7 / 3, 29 / 12, 5 / 2],
  [
    31 / 12,
    8 / 3,
    11 / 4,
    17 / 6,
    35 / 12,
    3,
    37 / 12,
    19 / 6,
    39 / 12,
    10 / 3,
    41 / 12,
    7 / 2,
    43 / 12,
    11 / 3,
    15 / 4,
  ],
];
const OPENNESS_WEIGHTS = [
  [2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.7, 2.6, 2.4, 2.3, 2.2, 2.1],
  [3, 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.7, 3.6, 3.4, 3.2, 3, 2.8, 2.6],
  [2.5, 2.4, 2.3, 2.2, 2.1, 2, 1.8, 1.6, 1.4, 1.2, 1, 0.8, 0.6, 0.4, 0],
];
const OVERALL_COUNT_WEIGHTS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
];

const botRatingAndCombination = (card, picked, seen, overallPool, synergies, initialState, inPack = 1, packNum = 1) => {
  // Find the color combination that gives us the highest score
  // that'll be the color combination we want to play currently.
  const pickNum = initialState?.[0]?.[packNum - 1]?.length - inPack + 1;
  let bestRating = -1;
  let bestCombination = [];
  for (const combination of COLOR_COMBINATIONS) {
    const considerFunc = considerInCombination(combination);
    if (!card || considerFunc(card)) {
      const scaling = COLOR_SCALING_FACTOR[combination.length];

      const cardValue = card?.rating ? toValue(botCardRating(combination, card)) : 1;

      let internalSynergy = 0.0000001;
      let synergy = 0.00000001;
      if (synergies) {
        const pickedInCombo = picked.cards.filter((card2) => considerFunc(card2));
        let count = 0;
        for (let i = 1; i < pickedInCombo.length; i++) {
          for (let j = 0; j < i; j++) {
            internalSynergy += similarity(synergies[pickedInCombo[i].index], synergies[pickedInCombo[j].index]) ** 10;
            count += 1;
          }
        }
        if (count) {
          internalSynergy /= count;
        }
        if (card) {
          const similarityExponent = picked.cards.length / 3;
          for (const { index } of pickedInCombo) {
            synergy += similarity(synergies[index], synergies[card.index]) ** similarityExponent;
          }
          if (pickedInCombo.length) {
            synergy /= pickedInCombo.length;
          }
        }
      }
      // The sum of the values of all cards in our pool, possibly
      // plus the card we are considering.
      const poolRating = picked[combination.join('')] + cardValue;
      // The sum of the values of all cards we've seen passed to
      // us times the number of times we've seen them.
      const seenCount = seen?.[combination.join('')] ?? 1;
      // This is technically cheating, but looks at the set of
      // all cards dealt out to players to see what the trends
      // for colors are. This is in value as well.
      const overallCount = overallPool?.[combination.join('')] || 1;
      // The ratio of seen to overall gives us an idea what is
      // being taken.
      const openness = seenCount / overallCount;
      // We weigh the factors with exponents to get a final score.
      // Everything uses exponents since that's how you weight a product.
      const rating =
        scaling ** findBestValue2d(COLORS_WEIGHTS, packNum, pickNum, initialState) *
        poolRating ** findBestValue2d(VALUE_WEIGHTS, packNum, pickNum, initialState) *
        openness ** findBestValue2d(OPENNESS_WEIGHTS, packNum, pickNum, initialState) *
        internalSynergy ** findBestValue2d(INTERNAL_SYNERGY_WEIGHTS, packNum, pickNum, initialState) *
        overallCount ** findBestValue2d(OVERALL_COUNT_WEIGHTS, packNum, pickNum, initialState) *
        synergy ** findBestValue2d(SYNERGY_WEIGHTS, packNum, pickNum, initialState);
      if (rating > bestRating) {
        bestRating = rating;
        bestCombination = combination;
      }
    }
  }
  return [bestRating, bestCombination];
};

const botRating = (card, picked, seen, overallPool, synergies, initialState, inPack = 1, packNum = 1) =>
  botRatingAndCombination(card, picked, seen, overallPool, synergies, initialState, inPack, packNum)[0];
const botColors = (card, picked, seen, overallPool, synergies, initialState, inPack = 1, packNum = 1) =>
  botRatingAndCombination(card, picked, seen, overallPool, synergies, initialState, inPack, packNum)[1];

function getSortFn(bot) {
  return (a, b) => {
    if (bot) {
      return botCardRating(bot, b) - botCardRating(bot, a);
    }
    return b.rating - a.rating;
  };
}

async function buildDeck(cards, picked, synergies, initialState) {
  let nonlands = cards.filter((card) => !card.details.type.toLowerCase().includes('land'));
  const lands = cards.filter((card) => card.details.type.toLowerCase().includes('land'));

  const colors = botColors(null, picked, null, null, synergies, initialState, 1, initialState[0].length);
  const sortFn = getSortFn(colors);
  const considerFunc = considerInCombination(colors);
  const inColor = nonlands.filter(considerFunc);
  const outOfColor = nonlands.filter((card) => !considerFunc(card));

  inColor.sort(sortFn);
  nonlands = inColor;
  let side = outOfColor;
  if (nonlands.length < 23) {
    outOfColor.sort(sortFn);
    nonlands.push(...outOfColor.splice(0, 23 - nonlands.length));
    side = [...outOfColor];
  }
  lands.sort(sortFn);
  const chosen = [];
  const calculateSynergy = (others, weight) => (card) => {
    let synergy = 0.0000001;
    if (synergies) {
      for (const { index: otherIndex } of others) {
        if (card.index !== otherIndex) {
          synergy += similarity(synergies[card.index], synergies[otherIndex]) ** 20;
        }
      }
    }
    return [(card.rating ? toValue(botCardRating(colors, card)) : 1) * synergy ** weight, card];
  };
  const totalSynergy = nonlands.map(calculateSynergy(nonlands, 4));
  totalSynergy.sort(([a], [b]) => b - a);
  const [[, mostSynergy]] = totalSynergy.splice(0, 1);
  chosen.push(mostSynergy);
  let remaining = totalSynergy.map(([, card]) => card);
  while (remaining.length > 0 && chosen.length < 23) {
    const nonlandsWithValue = remaining.map(calculateSynergy(chosen, 2));
    nonlandsWithValue.sort(([valueA], [valueB]) => valueB - valueA);
    const [[, bestValue]] = nonlandsWithValue.splice(0, 1);
    chosen.push(bestValue);
    remaining = nonlandsWithValue.map(([, index]) => index);
  }

  const main = chosen.concat(lands.slice(0, 17));
  side.push(...lands.slice(17));
  side.push(...remaining);

  const deck = [];
  const sideboard = [];
  for (let i = 0; i < 16; i += 1) {
    deck.push([]);
    if (i < 8) {
      sideboard.push([]);
    }
  }

  for (const card of main) {
    let index = Math.min(card.cmc ?? 0, 7);
    if (!card.details.type.toLowerCase().includes('creature')) {
      index += 8;
    }
    deck[index].push(card);
  }
  for (const card of side) {
    sideboard[Math.min(card.cmc ?? 0, 7)].push(card);
  }

  return {
    deck,
    sideboard,
    colors,
  };
}

function botPicks() {
  // make bots take one pick out of active packs
  for (let botIndex = 0; botIndex < draft.seats.length; botIndex++) {
    const {
      seen,
      picked,
      packbacklog: [packFrom],
      bot,
    } = draft.seats[botIndex];
    if (packFrom.length > 0 && bot) {
      const { overallPool, initial_state, synergies } = draft;
      let ratedPicks = [];
      const unratedPicks = [];
      const inPack = packFrom.length;
      const [packNum] = packPickNumber();
      for (let cardIndex = 0; cardIndex < packFrom.length; cardIndex++) {
        if (packFrom[cardIndex].rating) {
          ratedPicks.push(cardIndex);
        } else {
          unratedPicks.push(cardIndex);
        }
      }
      ratedPicks = ratedPicks
        .map((cardIndex) => [
          botRating(packFrom[cardIndex], picked, seen, overallPool, synergies, initial_state, inPack, packNum),
          cardIndex,
        ])
        .sort(([a], [b]) => b - a)
        .map(([, cardIndex]) => cardIndex);
      arrayShuffle(unratedPicks);

      const pickOrder = ratedPicks.concat(unratedPicks);
      const pickedCard = draft.seats[botIndex].packbacklog[0].splice(pickOrder[0], 1)[0];
      draft.seats[botIndex].pickorder.push(pickedCard);
      addSeen(picked, [pickedCard]);
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
  for (const seat of draft.seats) {
    if (seat.packbacklog && seat.packbacklog.length > 0) {
      addSeen(seat.seen, seat.packbacklog[0]);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pick(cardIndex) {
  await sleep(0);
  const card = draft.seats[0].packbacklog[0].splice(cardIndex, 1)[0];
  const packFrom = draft.seats[0].packbacklog[0];
  draft.seats[0].pickorder.push(card);
  passPack();
  const [packNum] = packPickNumber();
  csrfFetch(`/cube/api/draftpickcard/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify({
      draft_id: draft._id,
      pick: card.details.name,
      pack: packFrom.map((c) => c.details.name),
      packNum,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function finish() {
  // build bot decks
  const decksPromise = draft.seats.map((seat) => {
    return seat.bot && buildDeck(seat.pickorder, seat.picked, draft.synergies, draft.initial_state);
  });
  const decks = await Promise.all(decksPromise);

  for (let i = 0; i < draft.seats.length; i++) {
    if (draft.seats[i].bot) {
      const { deck, sideboard, colors } = decks[i];
      draft.seats[i].drafted = deck;
      draft.seats[i].sideboard = sideboard;
      draft.seats[i].name = `Bot ${i === 0 ? draft.seats.length : i}: ${colors.length > 0 ? colors.join(', ') : 'C'}`;
      draft.seats[i].description = `This deck was drafted by a bot with color preference for ${colors.join('')}.`;
    } else {
      const picked = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
      picked.cards = [];
      addSeen(picked, draft.seats[i].pickorder);
      const colors = botColors(
        null,
        picked,
        null,
        null,
        draft.synergies,
        draft.initial_state,
        1,
        draft.initial_state[0].length,
      );
      draft.seats[i].name = `${draft.seats[i].name}: ${colors.join(', ')}`;
    }
  }

  for (const seat of draft.seats) {
    for (const category of [seat.drafted, seat.sideboard, seat.packbacklog]) {
      for (const card of category) {
        delete card.details;
      }
    }
    for (const card of seat.pickorder) {
      delete card.details;
    }
    delete seat.seen;
    delete seat.picked;
  }

  for (const category of [draft.initial_state, draft.unopenedPacks]) {
    for (const seat of category) {
      for (const col of seat) {
        for (const card of col) {
          delete card.details;
        }
      }
    }
  }
  delete draft.overallPool;

  // save draft. if we fail, we fail
  await csrfFetch(`/cube/api/draftpick/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify(draft),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function allBotsDraft() {
  for (const seat of draft.seats) {
    seat.bot = [];
  }
  while (draft.seats[0].packbacklog.length > 0 && draft.seats[0].packbacklog[0].length > 0) {
    passPack();
  }
  finish();
}

export default {
  addSeen,
  allBotsDraft,
  arrangePicks,
  botColors,
  buildDeck,
  cube,
  finish,
  id,
  init,
  pack,
  packPickNumber,
  pick,
};
