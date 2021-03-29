import similarity from 'compute-cosine-similarity';

import { COLOR_COMBINATIONS, COLOR_INCLUSION_MAP, cardCmc, cardColorIdentity, cardType, cardCost } from 'utils/Card';
import { arrayShuffle, arraysAreEqualSets } from 'utils/Util';

import probTable from 'res/probTable.json';

// We want to discourage playing more colors so they get less
// value the more colors, this gets offset by having more cards.
const COLOR_SCALING_FACTOR = [1, 1, 0.75, 0.6, 0.33, 0.2];
const COLORS_WEIGHTS = [
  [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
  [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40],
  [60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
];
const RATING_WEIGHTS = [
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
];
const SYNERGY_WEIGHTS = [
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
];
const OPENNESS_WEIGHTS = [
  [4, 12, 12.3, 12.6, 13, 13.4, 13.7, 14, 15, 14.6, 14.2, 13.8, 13.4, 13, 12.6],
  [13, 12.6, 12.2, 11.8, 11.4, 11, 10.6, 10.2, 9.8, 9.4, 9, 8.6, 8.2, 7.8, 7],
  [8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1],
];
export const PROB_TO_INCLUDE = 0.67;

// This function gets approximate weight values when there are not 15 cards in the pack.
// It treat pack/pick number out of 3/15 as a lattice and just average the surrounding points if the desired weight is off the lattice.
const interpolateWeight = (weights, coordMaxPair, ...coordinates) => {
  if (!weights.length) {
    if (weights.length === 0) {
      return 0;
    }
    return weights;
  }
  const [coordinate, maxCoordinate] = coordMaxPair;
  const coordPercent = coordinate / maxCoordinate;
  const index = weights.length * coordPercent;
  const ceilIndex = Math.ceil(index);
  const floorIndex = Math.floor(index);
  // Is either an integer or is past the end by less than 1 so we can use floor as our index
  if (index === floorIndex || ceilIndex === weights.length) {
    return interpolateWeight(weights[Math.min(floorIndex, weights.length - 1)], ...coordinates);
  }
  // Ceil must be at most weights.length - 1 and floor must be ceil - 1 and at least 0
  // so the indexes below must be valid.
  // The fractional part of index.
  const indexModOne = index - floorIndex;
  // If is fractional and not past the end we weight it by the two
  // closest points by how close it is to that point.
  return (
    indexModOne * interpolateWeight(weights[ceilIndex], ...coordinates) +
    (1 - indexModOne) * interpolateWeight(weights[floorIndex], ...coordinates)
  );
};

export const FETCH_LANDS = {
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
  'Prismatic Vista': [...'WUBRG'],
  'Fabled Passage': [...'WUBRG'],
  'Terramorphic Expanse': [...'WUBRG'],
  'Evolving Wilds': [...'WUBRG'],
};

export const COLORS = ['W', 'U', 'B', 'R', 'G'];

// Ignore synergy below this value.
const SIMILARITY_CLIP = 0.7;
const SIMILARITY_MULTIPLIER = 1 / (1 - SIMILARITY_CLIP);

const scaleSimilarity = (value) =>
  SIMILARITY_MULTIPLIER * Math.min(Math.max(0, value - SIMILARITY_CLIP), 0.997 - SIMILARITY_CLIP);

// Scale to get similarity range to approximately [0, 10]
const SYNERGY_SCALE = 0.2;
const MAX_SYNERGY = 10;

const cardNameKeys = (a, b) => {
  return [a + b, b + a];
};

const synergyCache = {};

export const getSynergy = (card1, card2) => {
  if (
    !card1.details.embedding ||
    !card2.details.embedding ||
    card1.details.embedding.length === 0 ||
    card2.details.embedding.length === 0
  ) {
    return 0;
  }

  if (card1.details.name === card2.details.name) {
    return MAX_SYNERGY;
  }

  const keys = cardNameKeys(card1.details.name, card2.details.name);
  if (!synergyCache[keys[0]]) {
    const similarityValue = similarity(card1.details.embedding, card2.details.embedding);

    if (Number.isFinite(similarityValue)) {
      synergyCache[keys[0]] = -Math.log(1 - scaleSimilarity(similarityValue)) / SYNERGY_SCALE;
      synergyCache[keys[1]] = synergyCache[keys[0]];
    } else {
      synergyCache[keys[0]] = similarityValue > 0 ? MAX_SYNERGY : 0;
    }
  }

  return synergyCache[keys[0]];
};

export const considerInCombination = (combination, card) =>
  card && COLOR_INCLUSION_MAP[combination.join('')][(cardColorIdentity(card) ?? []).join('')];

export const isPlayableLand = (colors, card) =>
  considerInCombination(colors, card) ||
  colors.filter((c) => cardColorIdentity(card).includes(c)).length > 1 ||
  (FETCH_LANDS[card.details.name] && FETCH_LANDS[card.details.name].some((c) => colors.includes(c)));

export const getCastingProbability = (card, lands) => {
  if (!card.details.cost_colors) {
    const colorSymbols = {};
    const cost = cardCost(card);
    if (cost) {
      for (const symbol of cost) {
        const symbolLower = symbol.toLowerCase();
        const symbolColors = COLORS.filter(
          (color) =>
            symbolLower.includes(color.toLowerCase()) && !symbolLower.includes('p') && !symbolLower.includes('2'),
        );
        if (symbolColors.length > 0) {
          colorSymbols[symbolColors.join('')] = (colorSymbols[symbolColors.join('')] ?? 0) + 1;
        }
      }
    }
    card.details.cost_colors = Object.entries(colorSymbols);
  }
  const colors = card.details.cost_colors;
  if (cardType(card).toLowerCase().includes('land') || colors.length === 0) {
    return 1;
  }
  // We assume every card has at least 1 devotion to each color in its identity.
  if (colors.length === 1) {
    const [[color, devotion]] = colors;
    let landCount = 0;
    for (const [key, count] of Object.entries(lands)) {
      if ([...color].some((c) => key.includes(c))) {
        landCount += count;
      }
    }
    return probTable[cardCmc(card)]?.[devotion]?.[0]?.[landCount]?.[0]?.[0] ?? 0;
  }
  if (colors.length === 2) {
    const [[colorA, devotionA], [colorB, devotionB]] = colors;
    let landCountA = 0;
    let landCountB = 0;
    let landCountAB = 0;
    for (const [key, amount] of Object.entries(lands)) {
      const isA = [...colorA].some((c) => key.includes(c));
      const isB = [...colorB].some((c) => key.includes(c));
      if (isA && !isB) {
        landCountA += amount;
      } else if (!isA && isB) {
        landCountB += amount;
      } else if (isA && isB) {
        landCountAB += amount;
      }
    }
    return probTable[cardCmc(card)]?.[devotionA]?.[devotionB]?.[landCountA]?.[landCountB]?.[landCountAB] ?? 0;
  }
  // This is a really poor approximation, it probably underestimates,
  // but could easily overestimate as well.
  let totalDevotion = 0;
  let prob = 1;
  for (const [color, devotion] of colors) {
    totalDevotion += devotion;
    let landCount = 0;
    for (const [key, amount] of Object.entries(lands)) {
      if ([...color].some((c) => key.includes(c))) {
        landCount += amount;
      }
    }
    prob *= probTable[cardCmc(card)]?.[devotion]?.[0]?.[landCount]?.[0]?.[0] ?? 0;
  }
  let landCount = 0;
  for (const [key, amount] of Object.entries(lands)) {
    if (colors.some((color) => [...color].some((c) => key.includes(c)))) {
      landCount += amount;
    }
  }
  return prob * (probTable[cardCmc(card)]?.[totalDevotion]?.[0]?.[landCount]?.[0]?.[0] ?? 0);
};

// What is the raw power level of this card? Used to choose a card within a combination.
// Scale is roughly 0-10.
export const getRating = (card, probabilities) => {
  return probabilities[card.cardID] * 10 ** ((card?.rating ?? 1200) / 400 - 3);
};

// How much does the card we're considering synergize with the cards we've picked?
// Scale is roughly 0-10. Used to select a card within a combination.
export const getPickSynergy = (card, picked, probabilities) => {
  if (picked.cards.length === 0) {
    return 0;
  }

  let synergy = 0;
  for (const other of picked.cards) {
    // Maximum synergy is generally around .997 which corresponds to 10.
    synergy += probabilities[other.cardID] * getSynergy(card, other);
  }
  return (probabilities[card.cardID] * synergy) / picked.cards.length;
};

// How much do the cards we've already picked in this combo synergize with each other?
// Scale is roughly 0-10. Used to select a color combination.
// Tends to recommend what we've already picked before.
export const getInternalSynergy = (picked, probabilities, totalProb) => {
  if (picked.cards.length === 0) {
    return 0;
  }

  const numPairs = (picked.cards.length - 1) * totalProb;

  let synergy = 0;
  for (const card1 of picked.cards) {
    for (const card2 of picked.cards) {
      synergy += probabilities[card2] * probabilities[card1] * getSynergy(card1, card2);
    }
  }

  // Need to multiply it here as well since it is quadratic in cards in color
  return synergy / numPairs;
};

// The cost factor of playing more colors
export const getColorScaling = (combination) => {
  return COLOR_SCALING_FACTOR[combination.length];
};

// Has this color combination been flowing openly?
// Tends to recommend new colors to try.
// How good are the cards we've already picked in this color combo?
// Tends to recommend what we've already picked before.
// Scale from 0-10. Used to select a color combination.
export const getColorsOrOpenness = (picked, probabilities) => {
  const count = picked.cards.length;
  if (count === 0) {
    return 0;
  }

  return picked.cards.reduce((acc, card) => acc + getRating(card, probabilities), 0) / count;
};

const getCoordPairs = (pack, pick, initialState) => [
  [pack - 1, initialState[0].length],
  [pick - 1, initialState[0][Math.min(Math.max(pack - 1, 0), initialState[0].length - 1)].length],
];

export const getRatingWeight = (pack, pick, initialState) => {
  return interpolateWeight(RATING_WEIGHTS, ...getCoordPairs(pack, pick, initialState));
};

export const getSynergyWeight = (pack, pick, initialState) => {
  return interpolateWeight(SYNERGY_WEIGHTS, ...getCoordPairs(pack, pick, initialState));
};

export const getOpennessWeight = (pack, pick, initialState) => {
  return interpolateWeight(OPENNESS_WEIGHTS, ...getCoordPairs(pack, pick, initialState));
};

export const getColorWeight = (pack, pick, initialState) => {
  return interpolateWeight(COLORS_WEIGHTS, ...getCoordPairs(pack, pick, initialState));
};

const landCountsAreEqual = (count1, count2) =>
  !Object.entries(count1).some(([k, v]) => v !== (count2[k] ?? 0)) &&
  !Object.entries(count2).some(([k, v]) => v !== (count1[k] ?? 0));

// TODO: Consider dual lands?
export const getCombinationForLands = (lands) => {
  const combination = [...'WUBRG'].filter(
    (c) =>
      Object.entries(lands)
        .filter(([l]) => l.includes(c))
        .reduce((acc, [, x]) => acc + x, 0) >= 3,
  );
  return COLOR_COMBINATIONS.find((comb) => arraysAreEqualSets(combination, comb));
};

const calculateRating = (lands, _2, card, _3, picked, seen, packNum, pickNum, initialState) => {
  const probabilities = {};
  for (const c of seen.cards) {
    if ((probabilities[c.cardID] ?? null) === null) {
      probabilities[c.cardID] = getCastingProbability(c, lands);
    }
  }
  for (const c of picked.cards) {
    if ((probabilities[c.cardID] ?? null) === null) {
      probabilities[c.cardID] = getCastingProbability(c, lands);
    }
  }
  const totalProb = picked.cards.reduce((acc, c) => acc + probabilities[c.cardID], 0);
  if (card) {
    return (
      getInternalSynergy(picked, probabilities, totalProb) * getSynergyWeight(packNum, pickNum, initialState) +
      getColorsOrOpenness(seen, probabilities) * getOpennessWeight(packNum, pickNum, initialState) +
      getColorsOrOpenness(picked, probabilities) * getColorWeight(packNum, pickNum, initialState) +
      getPickSynergy(card, picked, probabilities) * getSynergyWeight(packNum, pickNum, initialState) +
      getRating(card, probabilities) * getRatingWeight(packNum, pickNum, initialState)
    );
  }
  // We can't filter on castable because that leads to returning
  // -Infinity for changes so we see a flat hill and stop climbing.
  const nonlands = picked.cards.WUBRG.filter((c) => !cardType(c).toLowerCase().includes('land'));
  const count = nonlands.length;
  const totalProbability = nonlands.reduce((acc, c) => acc + probabilities[c.cardID], 0);
  if (count >= 23) {
    return (
      // We can't just do pickedInCombination since that'll be empty
      // sometimes and more than 1 step from being non-empty
      (getColorsOrOpenness({ cards: nonlands }, probabilities) + getInternalSynergy(picked, probabilities, totalProb)) *
      Math.min(totalProbability, 23)
    );
  }
  return -Infinity;
};

// inPack is the number of cards in this pack
export const botRatingAndCombination = (card, picked, seen, initialState, inPack = 1, packNum = 1) => {
  // Find the color combination that gives us the highest score1
  // that'll be the color combination we want to play currently.
  const pickNum = (initialState?.[0]?.[packNum - 1]?.length ?? 0) - inPack + 1;
  let prevLands = {};
  // TODO: Only count dual lands in the combination we want to play.
  let currentLands = { ...picked.availableLands };
  const totalLands = Object.values(currentLands).reduce((x, y) => x + y, 0);
  while (totalLands > 17) {
    const index = Math.floor(Math.random() * totalLands);
    const curStart = 0;
    for (const [key, count] of Object.entries(currentLands)) {
      if (index < curStart + count) {
        currentLands[key] -= 1;
        if (currentLands[key] <= 0) {
          delete currentLands[key];
        }
        break;
      }
    }
    currentLands = { ...picked.availableLands };
  }
  let currentCombination = getCombinationForLands(currentLands);
  let currentRating = calculateRating(
    currentLands,
    currentCombination,
    card,
    0,
    picked,
    seen,
    packNum,
    pickNum,
    initialState,
  );
  while (!landCountsAreEqual(prevLands, currentLands)) {
    prevLands = currentLands;
    let nextLands = currentLands;
    let nextCombination = currentCombination;
    let nextRating = currentRating;
    const curLands = currentLands;
    const availableIncreases = arrayShuffle(
      Object.keys(picked.avilableLands).filter((c) => (curLands[c] ?? 0) < picked.avilableLands[c]),
    );
    for (const increaseColor of availableIncreases) {
      const availableDecreases = arrayShuffle(Object.keys(currentLands));
      for (const decreaseColor of availableDecreases) {
        if (increaseColor !== decreaseColor) {
          const newLands = { ...currentLands };
          newLands[increaseColor] = (newLands[increaseColor] ?? 0) + 1;
          newLands[decreaseColor] -= 1;
          if (newLands[decreaseColor] <= 0) {
            delete newLands[decreaseColor];
          }
          if (!landCountsAreEqual(newLands, prevLands)) {
            const newCombination = getCombinationForLands(newLands);
            const newRating = calculateRating(
              newLands,
              newCombination,
              card,
              0,
              picked,
              seen,
              packNum,
              pickNum,
              initialState,
            );
            if (newRating > nextRating) {
              nextLands = newLands;
              nextCombination = newCombination;
              nextRating = newRating;
              // We assume we won't get caught in a local maxima so it's safe to take first ascent.
              break;
            }
          }
        }
      }
    }
    if (!landCountsAreEqual(currentLands, nextLands)) {
      currentLands = nextLands;
      currentCombination = nextCombination;
      currentRating = nextRating;
    }
  }
  return { rating: currentRating, colors: currentCombination, lands: currentLands };
};

export default {
  getRating,
  getInternalSynergy,
  getPickSynergy,
  getColorsOrOpenness,
  getRatingWeight,
  getSynergyWeight,
  getOpennessWeight,
  getColorWeight,
  botRatingAndCombination,
  considerInCombination,
};
