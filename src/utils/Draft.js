import { cardCmc, cardName, cardType, cardIsSpecialZoneType } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import {
  evaluateCardOrPool,
  considerInCombination,
  getSynergy,
  isPlayableLand,
  MAX_SCORE,
  ORACLES_BY_NAME,
} from 'utils/draftbots';

// Ignore cards below this value.
const PROB_TO_INCLUDE = 0.67;

let draft = null;

export function init(newDraft) {
  draft = newDraft;
  if (draft.seats[0].packbacklog && draft.seats[0].packbacklog.length > 0) {
    for (const seat of draft.seats) {
      seat.seen = seat.packbacklog.cards.slice();
      seat.picked = [];
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
  return (draft.seats[0].packbacklog[0] || { sealed: false, trash: 0, cards: [] }).cards.map(
    (cardIndex) => draft.cards[cardIndex],
  );
}

const sealed = () => draft.seats[0].packbacklog[0]?.sealed ?? false;

function packPickNumber() {
  let picks = draft.seats[draft.seats.length - 1].pickorder.length;
  let packnum = 0;

  while (
    draft.initial_state[0][packnum] &&
    picks >= draft.initial_state[0][packnum].cards.length - draft.initial_state[0][packnum].trash
  ) {
    picks -= draft.initial_state[0][packnum].cards.length - draft.initial_state[0][packnum].trash;
    packnum += 1;
  }

  return [packnum + 1, picks + 1];
}

function arrangePicks(picks) {
  if (!Array.isArray(picks) || picks.length !== 16) {
    throw new Error('Picks must be an array of length 16.');
  }
  draft.seats[0].drafted = picks.map((pile) =>
    pile.map((pileCard) => draft.cards.findIndex((card) => card.cardID === pileCard.cardID)),
  );
}

export const getSeen = (seat) => {
  return draft.seats[seat].seen;
};

export const getPicked = (seat) => {
  return draft.seats[seat].pickorder;
};

function getSortFn(draftCards) {
  return (a, b) => {
    return draftCards[b].rating - draftCards[a].rating;
  };
}

const LAND_DICT = Object.freeze({
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
});

export const calculateBasicCounts = (picked, cards) => {
  const { lands, colors } = evaluateCardOrPool({
    picked,
    cards,
    seen: null,
    packNum: 3,
    pickNum: 15,
    numPacks: 3,
    packSize: 15,
  });
  const result = {};

  for (const [symbol, name] of Object.entries(LAND_DICT)) {
    result[name] = lands[symbol] ?? 0;
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

async function build({ lands, colors, probabilities }, picked, cards, basics) {
  let nonlands = picked.filter(
    (card) => !cardType(cards[card]).toLowerCase().includes('land') && !cardIsSpecialZoneType(cards[card]),
  );
  const landCards = picked.filter((card) => cardType(cards[card]).toLowerCase().includes('land'));
  const specialZoneCards = picked.filter((card) => cardIsSpecialZoneType(cards[card]));
  const sortFn = getSortFn(cards);
  const inColor = nonlands.filter((item) => probabilities[item] >= PROB_TO_INCLUDE);
  const outOfColor = nonlands.filter((item) => probabilities[item] < PROB_TO_INCLUDE);
  const playableLands = landCards.filter((land) => isPlayableLand(colors, cards[land]));
  const unplayableLands = landCards.filter((land) => !isPlayableLand(colors, cards[land]));

  playableLands.sort(sortFn);

  nonlands = inColor;
  let side = outOfColor;
  if (nonlands.length < 23) {
    outOfColor.sort(sortFn);
    nonlands.push(...outOfColor.splice(0, 23 - nonlands.length));
    side = [...outOfColor];
  }

  let chosen = [];
  const distanceFunc = (c1, c2) => 1 - getSynergy(c1, c2, cards) / MAX_SCORE;
  const NKernels = (n, total) => {
    let remaining = Math.min(total, nonlands.length);
    for (let i = 0; i < n; i++) {
      const floor = Math.floor(remaining / (n - i));
      remaining -= floor;
      const kernel = findShortestKSpanningTree(nonlands, distanceFunc, floor);
      chosen = chosen.concat(kernel);
      for (const ci of kernel) {
        const idx = nonlands.indexOf(ci);
        if (idx >= 0) nonlands.splice(idx, 1);
      }
    }
  };
  NKernels(2, 18);
  const size = Math.min(23 - chosen.length, nonlands.length);
  for (let i = 0; i < size; i++) {
    // add in new synergy data
    let best = 0;
    let bestScore = -Infinity;

    for (let j = 1; j < nonlands.length; j++) {
      const cardIndex = nonlands[j];
      const botState = {
        cards,
        cardIndex,
        probabilities,
        picked: chosen,
        seen: null,
        packNum: 3,
        pickNum: 15,
        numPacks: 3,
        packSize: 15,
      };
      const score =
        ORACLES_BY_NAME['Pick Synergy'].computeValue(botState) + ORACLES_BY_NAME.Rating.computeValue(botState);
      if (score > bestScore) {
        best = j;
        bestScore = score;
      }
    }
    const current = nonlands.splice(best, 1)[0];
    chosen.push(current);
  }

  const main = chosen.concat(playableLands.slice(0, 17));
  side.push(...playableLands.slice(17));
  side.push(...unplayableLands);
  side.push(...nonlands);
  side.push(...specialZoneCards);

  if (basics) {
    ({ lands, colors } = calculateBasicCounts(main, cards));
    for (const [name, amount] of Object.entries(lands)) {
      for (let i = 0; i < amount; i++) {
        main.push(basics[name].index);
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

  for (const cardIndex of main) {
    const card = cards[cardIndex];
    let index = Math.min(cardCmc(card) ?? 0, 7);
    if (!card.details.type.toLowerCase().includes('creature') && !card.details.type.toLowerCase().includes('basic')) {
      index += 8;
    }
    deck[index].push(cardIndex);
  }

  // sort the basic land col
  deck[0].sort((a, b) => cardName(cards[a]).localeCompare(cardName(cards[b])));

  for (const cardIndex of side) {
    sideboard[Math.min(cardCmc(cards[cardIndex]) ?? 0, 7)].push(cardIndex);
  }

  return {
    deck,
    sideboard,
    colors,
  };
}

export async function buildDeck(cards, picked, basics) {
  const botEvaluation = evaluateCardOrPool(null, {
    cards,
    picked,
    seen: null,
    packNum: 3,
    pickNum: 15,
    numPacks: 3,
    packSize: 15,
  });
  return build(botEvaluation, cards, picked, basics);
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
    if (packFrom.cards.length > 0 && bot) {
      const { cards, initial_state } = draft;
      const [packNum, pickNum] = packPickNumber();
      const numPacks = initial_state[0].length;
      const packSize = initial_state[0][Math.min(Math.max(packNum - 1, 0), initial_state[0].length - 1)].length;
      const drafterState = { cards, picked, seen, packNum, pickNum, numPacks, packSize };
      const [[, pickedPackIndex]] = packFrom
        .map((cardIndex, packIndex) => [evaluateCardOrPool(cardIndex, drafterState).score, packIndex])
        .sort(([a], [b]) => b - a);
      const pickedCard = draft.seats[botIndex].packbacklog[0].cards.splice(pickedPackIndex, 1)[0];
      draft.seats[botIndex].pickorder.push(pickedCard);
      picked.push(pickedCard);
    }
  }
}

const passPackInternal = () => {
  // check if pack is done
  if (draft.seats.every((seat) => seat.packbacklog[0].cards.length <= seat.packbacklog[0].trash)) {
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
  } else {
    const [, pickNum] = packPickNumber();
    if ((pickNum - 1) % draft.seats[0].packbacklog[0].picksPerPass !== 0) {
      return;
    }
    if (draft.unopenedPacks[0].length % 2 === 0) {
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
  for (const seat of draft.seats) {
    if (seat.packbacklog?.length > 0) {
      seat.seen.push(...seat.packbacklog[0].cards);
    }
  }
};

function passPack() {
  botPicks();
  passPackInternal();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const nextPack = () => {
  for (const seat of draft.seats) {
    const pickedCards = seat.packbacklog[0].cards.splice(0, seat.packbacklog[0].cards.length);
    seat.pickorder.push(...pickedCards);
    if (seat.bot) {
      seat.picked.push(...pickedCards);
    }
  }
  passPackInternal();
};

async function pick(cardIndex) {
  await sleep(0);
  const ci = draft.seats[0].packbacklog[0].cards.splice(cardIndex, 1)[0];
  const card = draft.cards[ci];
  const packFrom = draft.seats[0].packbacklog[0];
  draft.seats[0].pickorder.push(ci);
  passPack();
  const [packNum] = packPickNumber();
  csrfFetch(`/cube/api/draftpickcard/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify({
      draft_id: draft._id,
      pick: card.details.name,
      packNum,
      pack: packFrom.cards.map((c) => draft.cards[c].details.name),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function finish() {
  // build bot decks
  const decksPromise = draft.seats.map((seat) => {
    return seat.bot && buildDeck(draft.cards, seat.pickorder, seat.picked, draft.basics);
  });
  const decks = await Promise.all(decksPromise);
  const { cards } = draft;

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
      const picked = draft.seats[i].pickorder.slice();
      const { colors } = evaluateCardOrPool({
        cards,
        picked,
        seen: null,
        packNum: 3,
        pickNum: 15,
        numPacks: 3,
        packSize: 15,
      });
      draft.seats[i].name = `${draft.seats[i].name}: ${colors.join(', ')}`;
    }
  }

  for (const seat of draft.seats) {
    delete seat.seen;
    delete seat.picked;
  }

  for (const card of draft.cards) {
    delete card.details;
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

export async function allBotsDraft(noFinish) {
  for (const seat of draft.seats) {
    seat.bot = [];
  }
  while (draft.seats[0].packbacklog.length > 0 && draft.seats[0].packbacklog[0].cards.length > 0) {
    passPack();
  }
  if (!noFinish) {
    await finish();
  }
}

export default {
  allBotsDraft,
  arrangePicks,
  buildDeck,
  calculateBasicCounts,
  cube,
  finish,
  id,
  init,
  nextPack,
  pack,
  packPickNumber,
  pick,
  considerInCombination,
  isPlayableLand,
  sealed,
};
