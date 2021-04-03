import { evaluateCardsOrPool, getSynergy, MAX_SCORE, ORACLES_BY_NAME, FETCH_LANDS } from 'drafting/draftbots';
import { cardCmc, cardColorIdentity, cardIsSpecialZoneType, cardName, cardType } from 'utils/Card';
import { arraysAreEqualSets } from 'utils/Util';

// Ignore cards below this value.
const PROB_TO_INCLUDE = 0.67;

const getSortFn = (draftCards) => (a, b) => draftCards[b].rating - draftCards[a].rating;

const LAND_DICT = Object.freeze({
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
});

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

export const calculateBasicCounts = (picked, cards) => {
  const {
    botState: { lands },
    colors,
  } = evaluateCardsOrPool([], {
    picked,
    cards,
    seen: picked,
    packNum: 3,
    pickNum: 15,
    numPacks: 3,
    packSize: 15,
  });
  const result = {};
  console.debug('calculateBasicLandCounts', lands);

  for (const [symbol, name] of Object.entries(LAND_DICT)) {
    result[name] = lands[symbol] ?? 0;
  }
  return { lands: result, colors };
};

async function build({ botState: { cards, picked, probabilities, lands }, colors }) {
  let nonlands = picked.filter(
    (card) => !cardType(cards[card]).toLowerCase().includes('land') && !cardIsSpecialZoneType(cards[card]),
  );
  console.log(picked);
  const landCards = picked.filter((card) => cardType(cards[card]).toLowerCase().includes('land'));
  const specialZoneCards = picked.filter((card) => cardIsSpecialZoneType(cards[card]));
  const sortFn = getSortFn(cards);
  const inColor = nonlands.filter((item) => probabilities[item] >= PROB_TO_INCLUDE);
  const outOfColor = nonlands.filter((item) => probabilities[item] < PROB_TO_INCLUDE);

  const main = [];
  console.log(lands);
  for (const [comb, count] of Object.entries(lands)) {
    for (let i = 0; i < count; i++) {
      const match = landCards.findIndex((ci) =>
        arraysAreEqualSets([...comb], FETCH_LANDS[cardName(cards[ci])] ?? cardColorIdentity(cards[ci])),
      );
      if (match === -1) {
        console.warning('Could not find a matching land that the bots said was there.');
      } else {
        main.push(landCards.splice(match, 1)[0]);
      }
    }
  }

  nonlands = inColor;
  let side = outOfColor;
  const neededNonLands = 40 - main.length;
  if (nonlands.length < neededNonLands) {
    outOfColor.sort(sortFn);
    nonlands.push(...outOfColor.splice(0, neededNonLands - nonlands.length));
    side = [...outOfColor];
  }

  const distanceFunc = (c1, c2) => 1 - (probabilities[c1] * probabilities[c2] * getSynergy(c1, c2, cards)) / MAX_SCORE;
  const NKernels = (n, total) => {
    let remaining = Math.min(total, nonlands.length);
    for (let i = 0; i < n; i++) {
      const floor = Math.floor(remaining / (n - i));
      remaining -= floor;
      const kernel = findShortestKSpanningTree(nonlands, distanceFunc, floor);
      main.push(...kernel);
      for (const ci of kernel) {
        const idx = nonlands.indexOf(ci);
        if (idx >= 0) nonlands.splice(idx, 1);
      }
    }
  };
  NKernels(2, Math.floor(neededNonLands * 0.75));
  const size = Math.min(neededNonLands - main.length, nonlands.length);
  for (let i = 0; i < size; i++) {
    // add in new synergy data
    let best = 0;
    let bestScore = -Infinity;

    for (let j = 1; j < nonlands.length; j++) {
      const cardIndex = nonlands[j];
      const botState = {
        cards,
        cardIndices: [cardIndex],
        probabilities,
        basics: [],
        picked: main,
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
    main.push(current);
  }

  side.push(...landCards);
  side.push(...nonlands);
  side.push(...specialZoneCards);

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

  for (const cardIndex of side.filter((ci) => !cards[ci].isUnlimited)) {
    sideboard[Math.min(cardCmc(cards[cardIndex]) ?? 0, 7)].push(cardIndex);
  }
  for (const cardIndex of main) {
    console.log(cards[cardIndex]);
  }

  return {
    deck,
    sideboard,
    colors,
  };
}

export async function buildDeck(cards, picked, basics) {
  const botEvaluation = evaluateCardsOrPool(null, {
    cards,
    picked: picked.concat(...basics.map((ci) => new Array(20).fill(ci))),
    seen: [],
    basics: [],
    packNum: 3,
    pickNum: 15,
    numPacks: 3,
    packSize: 15,
  });
  return build(botEvaluation);
}
