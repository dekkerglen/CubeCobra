import similarity from 'compute-cosine-similarity';

import { cardColorIdentity, cardName, cardType, cardIsSpecialZoneType } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import {
  getRating,
  botRatingAndCombination,
  considerInCombination,
  getPickSynergy,
  isPlayableLand,
  setSynergyMatrix,
  getCastingProbability,
  COLORS,
  FETCH_LANDS,
  PROB_TO_INCLUDE,
} from 'utils/draftbots';

let draft = null;

export const createSeen = () => {
  const result = {
    cards: [],
    lands: { W: 0, U: 0, B: 3, R: 3, G: 3 },
  };
  let desiredLandCount = 17;
  for (let i = 5; i > 0; i--) {
    result.lands[COLORS[5 - i]] = Math.floor(desiredLandCount / i);
    desiredLandCount -= result.lands[COLORS[5 - i]];
  }
  return result;
};

// This function tracks the total goodness of the cards we've seen or picked in this color.
export const addSeen = (seen, cards) => {
  for (const card of cards) {
    if (cardType(card).toLowerCase().includes('land')) {
      const colors = FETCH_LANDS[cardName(card)] ?? cardColorIdentity(card);
      seen.lands[colors.join('')] = (seen.lands[colors.join('')] ?? 0) + 1;
      let removed = false;
      for (const color of colors) {
        if (!removed && seen.lands[color] > 0) {
          removed = true;
          seen.lands[color] -= 1;
        }
      }
      if (!removed) {
        const color = COLORS.find((c) => seen.lands[c] > 0);
        if (color) seen.lands[color] -= 1;
      }
    }
    if (card.index || card.index === 0) {
      seen.cards.push(card);
    }
  }
};

export function init(newDraft) {
  draft = newDraft;
  const maxIndex = Math.max(...draft.initial_state.flat(3).map(({ index }) => index));
  setSynergyMatrix(maxIndex);
  if (draft.seats[0].packbacklog && draft.seats[0].packbacklog.length > 0) {
    for (const seat of draft.seats) {
      seat.seen = createSeen();
      addSeen(seat.seen, seat.packbacklog[0].slice());
      seat.picked = createSeen();
    }
  }
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

export const getSeen = (seat) => {
  return draft.seats[seat].seen;
};

export const getPicked = (seat) => {
  return draft.seats[seat].pickorder;
};

export const botRating = (card, picked, seen, synergies, initialState, inPack = 1, packNum = 1) =>
  botRatingAndCombination(card, picked, seen, synergies, initialState, inPack, packNum).rating;
const botColors = (card, picked, seen, synergies, initialState, inPack = 1, packNum = 1) =>
  botRatingAndCombination(card, picked, seen, synergies, initialState, inPack, packNum).colors;

function getSortFn(bot) {
  return (a, b) => {
    if (bot) {
      return getRating(bot, b) - getRating(bot, a);
    }
    return b.rating - a.rating;
  };
}

export const calculateBasicCounts = (main, synergies) => {
  const picked = createSeen();
  addSeen(picked, main);
  const { lands, colors } = botRatingAndCombination(null, picked, null, synergies, null, 0, 0);

  const result = {};

  const landDict = {
    W: 'Plains',
    U: 'Island',
    B: 'Swamp',
    R: 'Mountain',
    G: 'Forest',
  };
  for (const [symbol, name] of Object.entries(landDict)) {
    result[name] = lands[symbol];
  }
  return { lands: result, colors };
};

const allPairsShortestPath = (distances) => {
  const result = [];
  for (let i = 0; i < distances.length; i++) {
    result.push([]);
    for (let j = 0; j < distances.length; j++) {
      result[i].push(distances[i][j]);
    }
  }
  for (let k = 0; k < distances.length; k++) {
    for (let i = 0; i < distances.length; i++) {
      for (let j = 0; j < distances.length; j++) {
        if (result[i][j] > result[i][k] + result[k][j]) {
          result[i][j] = result[i][k] + result[k][j];
        }
      }
    }
  }
  return result;
};

const findShortestKSpanningTree = (nodes, distanceFunc, k) => {
  const closest = [];
  const distancesPre = [];
  for (let i = 0; i < nodes.length; i++) {
    distancesPre.push([]);
    for (let j = 0; j < nodes.length; j++) {
      distancesPre[i].push(0);
    }
  }
  for (let i = 1; i < nodes.length; i++) {
    distancesPre.push([]);
    for (let j = 0; j < i; j++) {
      if (i !== j) {
        // Assume distance is symmetric.
        const distance = distanceFunc(nodes[i], nodes[j]);
        distancesPre[i][j] = distance;
        distancesPre[j][i] = distance;
      }
    }
  }
  const distances = allPairsShortestPath(distancesPre);
  // Sort nodes by distance so we can find the i-closest for i < k.
  for (let i = 0; i < nodes.length; i++) {
    closest.push(
      distances[i]
        .map((distance, ind) => [distance, ind])
        .filter(([, ind]) => ind !== i)
        .sort(([a], [b]) => a - b),
    );
  }

  // Contains distance, amount from left to take, left index, and right index
  let bestDistance = Infinity;
  let bestNodes = [];
  // We're looping over every possible center for the spanning tree which likely
  // lies in the middle of an edge, not at a point.
  for (let i = 1; i < nodes.length; i++) {
    // Check the case where this node is the center.
    if (bestDistance > closest[i][k - 2] + closest[i][k - 3]) {
      bestDistance = closest[i][k - 2] + closest[i][k - 3];
      bestNodes = closest[i].slice(0, k - 1).concat([i]);
    }
    for (let j = 0; j < i; j++) {
      const closestI = closest[i].filter(([, ind]) => ind !== j);
      const closestJ = closest[j].filter(([, ind]) => ind !== i);
      const seen = [i, j];
      const distance = distances[i][j];
      let iInd = -1;
      let jInd = -1;
      let included = 2;
      while (included < k) {
        // The edge must be the center so the weights here have to stay close to each other
        if (
          (iInd >= 0 ? closestI[iInd][0] : 0) + distance < (jInd >= 0 ? closestJ[jInd][0] : 0) &&
          iInd < closestI.length - 1
        ) {
          iInd += 1;
          const [, ind] = closestI[iInd];
          if (!seen.includes(ind)) {
            included += 1;
            seen.push(ind);
          }
          // Same here
        } else if (
          (jInd >= 0 ? closestJ[jInd][0] : 0) + distance < (iInd >= 0 ? closestI[iInd][0] : 0) &&
          jInd < closestJ.length - 1
        ) {
          jInd += 1;
          const [, ind] = closestJ[jInd];
          if (!seen.includes(ind)) {
            included += 1;
            seen.push(ind);
          }
          // the next j is closer than the next i. This is technically incorrect since you
          // could have a cluster just slightly farther away on the i side but it should be
          // close enough for our purposes
        } else if (
          jInd < closestJ.length - 1 &&
          (jInd >= 0 ? closestJ[jInd + 1][0] : 0) < (iInd >= 0 ? closestI[iInd + 1][0] : 0)
        ) {
          jInd += 1;
          const [, ind] = closestJ[jInd];
          if (!seen.includes(ind)) {
            included += 1;
            seen.push(ind);
          }
          // Either there are no more j's or the next i is closer than the next j
        } else if (iInd < closestI.length - 1) {
          iInd += 1;
          const [, ind] = closestI[iInd];
          if (!seen.includes(ind)) {
            included += 1;
            seen.push(ind);
          }
          // no more i's so we'll try to add a j, this can only happen when there aren't k nodes.
        } else if (jInd < closestJ.length - 1) {
          jInd += 1;
          const [, ind] = closestJ[jInd];
          if (!seen.includes(ind)) {
            included += 1;
            seen.push(ind);
          }
          // no more nodes
        } else {
          throw new Error('Not enough nodes to make a K-set.');
        }
      }
      const length = distance + (iInd >= 0 ? closestI[iInd][0] : 0) + (jInd >= 0 ? closestJ[jInd][0] : 0);
      if (length < bestDistance) {
        bestNodes = seen;
        bestDistance = length;
      }
    }
  }
  return bestNodes.map((ind) => nodes[ind]);
};

async function build(cards, lands, synergies, colors, basics) {
  let nonlands = cards.filter((card) => !cardType(card).toLowerCase().includes('land') && !cardIsSpecialZoneType(card));
  const landCards = cards.filter((card) => cardType(card).toLowerCase().includes('land'));
  const specialZoneCards = cards.filter(cardIsSpecialZoneType);

  const sortFn = getSortFn(colors);
  const inColor = nonlands.filter((item) => getCastingProbability(item, lands) >= PROB_TO_INCLUDE);
  const outOfColor = nonlands.filter((item) => getCastingProbability(item, lands) < PROB_TO_INCLUDE);

  landCards.sort(sortFn);

  const playableLands = landCards.filter((land) => isPlayableLand(colors, land));
  const unplayableLands = landCards.filter((land) => !isPlayableLand(colors, land));
  nonlands = inColor;
  let side = outOfColor;
  if (nonlands.length < 23) {
    outOfColor.sort(sortFn);
    nonlands.push(...outOfColor.splice(0, 23 - nonlands.length));
    side = [...outOfColor];
  }

  let chosen = [];
  if (synergies) {
    // 1 - synergy since we are measuring distance instead of closeness.
    const distanceFunc = (c1, c2) => 1 - similarity(synergies[c1.index], synergies[c2.index]); // + (4800 - c1.rating - c2.rating) / 2400;
    // const distanceFunc = (c1, c2) => {
    //   const vec1 = synergies[c1.index];
    //   const vec2 = synergies[c2.index];
    //   let sum = 0;
    //   for (let i = 0; i < vec1.length; i++) {
    //     sum += (vec1[i] - vec2[i]) ** 2;
    //   }
    //   return Math.sqrt(sum) + 24000 / (c1.rating + c2.rating);
    // };
    const NKernels = (n, total) => {
      let remaining = Math.min(total, nonlands.length);
      for (let i = 0; i < n; i++) {
        const floor = Math.floor(remaining / (n - i));
        remaining -= floor;
        const kernel = findShortestKSpanningTree(nonlands, distanceFunc, floor);
        chosen = chosen.concat(kernel);
        // eslint-disable-next-line no-loop-func
        nonlands = nonlands.filter((c) => !chosen.includes(c));
      }
    };
    NKernels(2, 18);
    const played = createSeen();
    addSeen(played, chosen, synergies);
    const size = Math.min(23 - chosen.length, nonlands.length);
    const probabilities = {};
    for (const c of nonlands) {
      probabilities[c.cardID] = getCastingProbability(c, lands);
    }
    for (let i = 0; i < size; i++) {
      // add in new synergy data
      let best = 0;
      let bestScore = -Infinity;

      for (let j = 1; j < nonlands.length; j++) {
        const card = nonlands[j];
        const score =
          getPickSynergy(chosen, card, played, synergies, probabilities) + getRating(colors, card, probabilities);
        if (score > bestScore) {
          best = j;
          bestScore = score;
        }
      }
      const current = nonlands.splice(best, 1)[0];
      addSeen(played, [current], synergies);
      chosen.push(current);
    }
    nonlands = nonlands.filter((c) => !chosen.includes(c));
  } else {
    chosen = nonlands.sort(sortFn).slice(0, 23);
    nonlands = nonlands.slice(23);
  }

  const main = chosen.concat(playableLands.slice(0, 17));
  side.push(...playableLands.slice(17));
  side.push(...unplayableLands);
  side.push(...nonlands);
  side.push(...specialZoneCards);

  if (basics) {
    ({ lands, colors } = calculateBasicCounts(main, synergies));
    for (const [name, amount] of Object.entries(lands)) {
      for (let i = 0; i < amount; i++) {
        main.push(basics[name]);
      }
    }
  }
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
    if (!cardType(card).toLowerCase().includes('creature') && !card.details.type.toLowerCase().includes('basic')) {
      index += 8;
    }
    deck[index].push(card);
  }

  // sort the basic land col
  deck[0].sort((a, b) => a.details.name.localeCompare(b.details.name));

  for (const card of side) {
    sideboard[Math.min(card.cmc ?? 0, 7)].push(card);
  }

  return {
    deck,
    sideboard,
    colors,
  };
}

export async function buildDeck(cards, picked, synergies, basics) {
  const { colors, lands } = botRatingAndCombination(null, picked, null, null, synergies, null);
  return build(cards, lands, synergies, colors, basics);
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
      const { initial_state, synergies } = draft;
      const ratedPicks = [];
      const inPack = packFrom.length;
      const [packNum] = packPickNumber();
      for (let cardIndex = 0; cardIndex < packFrom.length; cardIndex++) {
        if (!packFrom[cardIndex].rating) {
          packFrom[cardIndex].rating = 1200;
        }
        ratedPicks.push(cardIndex);
      }
      const ratedPicksWithRating = ratedPicks
        .map((cardIndex) => {
          const { rating, lands } = botRatingAndCombination(
            packFrom[cardIndex],
            picked,
            seen,
            synergies,
            initial_state,
            inPack,
            packNum,
          );
          return [rating, lands, cardIndex];
        })
        .sort(([a], [b]) => b - a);

      [[, picked.lands]] = ratedPicksWithRating;
      const pickedCard = draft.seats[botIndex].packbacklog[0].splice(ratedPicksWithRating[0][2], 1)[0];
      draft.seats[botIndex].pickorder.push(pickedCard);
      addSeen(picked, [pickedCard], draft.synergies);
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
    return seat.bot && buildDeck(seat.pickorder, seat.picked, draft.synergies, draft.basics);
  });
  const decks = await Promise.all(decksPromise);

  let botIndex = 1;
  for (let i = 0; i < draft.seats.length; i++) {
    if (draft.seats[i].bot) {
      const { deck, sideboard, colors } = decks[i];
      draft.seats[i].drafted = deck;
      draft.seats[i].sideboard = sideboard;
      draft.seats[i].name = `Bot ${botIndex}: ${colors.length > 0 ? colors.join(', ') : 'C'}`;
      draft.seats[i].description = `This deck was drafted by a bot with color preference for ${colors.join('')}.`;
      botIndex += 1;
    } else {
      const picked = createSeen();
      addSeen(picked, draft.seats[i].pickorder, draft.synergies);
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

  // save draft. if we fail, we fail
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
  addSeen,
  createSeen,
  allBotsDraft,
  arrangePicks,
  botColors,
  buildDeck,
  calculateBasicCounts,
  cube,
  finish,
  id,
  init,
  pack,
  packPickNumber,
  pick,
  considerInCombination,
  isPlayableLand,
};
