import similarity from 'compute-cosine-similarity';

import {
  COLOR_COMBINATIONS,
  COLOR_INCLUSION_MAP,
  cardCmc,
  cardColorIdentity,
  cardName,
  cardType,
  cardDevotion,
} from 'utils/Card';
import { arraysAreEqualSets, fromEntries } from 'utils/Util';

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
const FIXING_WEIGHTS = [
  [0.1, 0.3, 0.6, 0.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
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
export const PROB_TO_INCLUDE = 0.75;

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

let synergyMatrix;

export const setSynergyMatrix = (size) => {
  synergyMatrix = [];
  for (let i = 0; i <= size; i++) {
    synergyMatrix.push(new Array(size + 1).fill(null));
  }
};

export const getSynergy = (index1, index2, synergies) => {
  if (!synergies) return 0;
  if (synergyMatrix[index1][index2] === null) {
    const similarityValue = similarity(synergies[index1], synergies[index2]);
    if (Number.isFinite(similarityValue)) {
      synergyMatrix[index1][index2] = -Math.log(1 - scaleSimilarity(similarityValue)) / SYNERGY_SCALE;
    }
    // This happens when similarityValue is 1, usually because a card is a duplicate.
    if (!Number.isFinite(synergyMatrix[index1][index2])) {
      synergyMatrix[index1][index2] = MAX_SYNERGY;
    }
    synergyMatrix[index2][index1] = synergyMatrix[index1][index2];
  }
  return synergyMatrix[index1][index2];
};

const BASICS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

export const considerInCombination = (combination, card) =>
  card && COLOR_INCLUSION_MAP[combination.join('')][(cardColorIdentity(card) ?? []).join('')];

export const isPlayableLand = (colors, card) =>
  considerInCombination(colors, card) ||
  colors.filter((c) => cardColorIdentity(card).includes(c)).length > 1 ||
  (FETCH_LANDS[card.details.name] && FETCH_LANDS[card.details.name].some((c) => colors.includes(c)));

const getDevotions = (card) =>
  fromEntries(
    cardType(card).toLowerCase().includes('land')
      ? []
      : cardColorIdentity(card).map((color) => [color, Math.max(1, cardDevotion(card, color))]),
  );

export const getCastingProbability = (card, lands) => {
  // TODO: Handle hybrid
  const colors = FETCH_LANDS[cardName(card)] ?? cardColorIdentity(card);
  if (cardType(card).toLowerCase().includes('land') || colors.length === 0) {
    return 1;
  }
  // We assume every card has at least 1 devotion to each color in its identity.
  if (colors.length === 1) {
    const devotion = Math.max(1, cardDevotion(card, colors[0]));
    let landCount = lands[colors[0]];
    for (const key of Object.keys(lands)) {
      if (key.length > 1 && key.includes(colors[0])) {
        landCount += lands[key];
      }
    }
    return probTable[cardCmc(card)]?.[devotion]?.[0]?.[landCount]?.[0]?.[0] ?? 0;
  }
  if (colors.length === 2) {
    const devotionA = Math.max(1, cardDevotion(card, colors[0]));
    const devotionB = Math.max(1, cardDevotion(card, colors[1]));
    let landCountA = lands[colors[0]];
    const landCountB = lands[colors[1]];
    let landCountAB = 0;
    for (const key of Object.keys(lands)) {
      if (key.length > 1) {
        if (key.includes(colors[0]) && !key.includes(colors[1])) {
          landCountA += lands[key];
        } else if (key.includes(colors[1]) && !key.includes(colors[0])) {
          landCountA += lands[key];
        } else if (key.includes(colors[0]) && key.includes(colors[1])) {
          landCountAB += lands[key];
        }
      }
    }
    return probTable[cardCmc(card)]?.[devotionA]?.[devotionB]?.[landCountA]?.[landCountB]?.[landCountAB] ?? 0;
  }
  // This is a really poor approximation, it probably underestimates,
  // but could easily overstimate as well.
  let totalDevotion = 0;
  let prob = 1;
  for (const color of colors) {
    const devotion = Math.max(1, cardDevotion(card, color));
    totalDevotion += devotion;
    let landCount = lands[color];
    for (const key of Object.keys(lands)) {
      if (key.length > 1 && key.includes(color)) {
        landCount += lands[key];
      }
    }
    prob *= probTable[cardCmc(card)]?.[devotion]?.[0]?.[landCount]?.[0]?.[0] ?? 0;
  }
  let landCount = 0;
  for (const key of Object.keys(lands)) {
    if (colors.some((color) => key.includes(color))) {
      landCount += lands[key];
    }
  }
  return prob * (probTable[cardCmc(card)]?.[totalDevotion]?.[0]?.[landCount]?.[0]?.[0] ?? 0);
};

// What is the raw power level of this card? Used to choose a card within a combination.
// Scale is roughly 0-10.
export const getRating = (card) => {
  return 10 ** ((card?.rating ?? 1200) / 400 - 3);
};

// How much does the card we're considering synergize with the cards we've picked?
// Scale is roughly 0-10. Used to select a card within a combination.
export const getPickSynergy = (pickedInCombination, card, picked, synergies) => {
  if (picked.cards.WUBRG.length === 0 || !synergies) {
    return 0;
  }

  let synergy = 0;
  if (synergies && card) {
    for (const { index } of pickedInCombination) {
      // Don't count synergy for duplicate cards.
      // Maximum synergy is generally around .997 which corresponds to 10.
      if (index !== card.index) {
        synergy += getSynergy(index, card.index, synergies);
      }
    }
  }
  return synergy / picked.cards.WUBRG.length;
};

// Does this help us fix for this combination of colors?
// Scale from 0-10. Perfect is five-color land in 5 color combination.
// Used to select a card within a color combination.
export const getFixing = (combination, card) => {
  const colors = FETCH_LANDS[card.details.name] ?? cardColorIdentity(card);
  const typeLine = cardType(card);
  const isLand = typeLine.includes('Land');
  const isFetch = !!FETCH_LANDS[cardName(card)];

  if (isLand) {
    const overlap = 4 * colors.filter((c) => combination.includes(c)).length;
    const hasBasicTypes = BASICS.filter((basic) => typeLine.toLowerCase().includes(basic.toLowerCase())).length > 1;
    if (isFetch) {
      return overlap;
    }
    if (hasBasicTypes) {
      return 0.75 * overlap;
    }
    return 0.5 * overlap;
  }
  return 0;
};

// How much do the cards we've already picked in this combo synergize with each other?
// Scale is roughly 0-10. Used to select a color combination.
// Tends to recommend what we've already picked before.
export const getInternalSynergy = (pickedInCombination, picked, synergies) => {
  if (picked.cards.WUBRG.length === 0) {
    return 0;
  }

  const numPairs = (picked.cards.WUBRG.length * (picked.cards.WUBRG.length + 1)) / 2;

  let synergy = 0;
  for (const { index: index1 } of pickedInCombination) {
    for (const { index: index2 } of pickedInCombination) {
      if (index1 !== index2) {
        synergy += getSynergy(index1, index2, synergies);
      }
    }
  }

  // Need to multiply it here as well since it is quadratic in cards in color
  return synergy / numPairs;
};

// Has this color combination been flowing openly?
// Scale from roughly 0-10. Used to select a color combination.
// Tends to recommend new colors to try.
export const getOpenness = (combination, seen) => {
  if (seen.cards.length === 0) {
    return 0;
  }

  return seen.values[combination.join('')] / seen.cards.WUBRG.length;
};

// How good are the cards we've already picked in this color combo?
// Scale from 0-1. Used to select a color combination.
// Tends to recommend what we've already picked before.
export const getColor = (pickedInCombination, picked, lands) => {
  const count = picked.cards.WUBRG.length - picked.cards[''].length;
  if (count === 0) {
    return 0;
  }

  return (
    pickedInCombination.reduce((acc, card) => acc + getRating(card) * getCastingProbability(card, lands), 0) / count
  );
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

export const getFixingWeight = (pack, pick, initialState) => {
  return interpolateWeight(FIXING_WEIGHTS, ...getCoordPairs(pack, pick, initialState));
};

const landCountsAreEqual = (count1, count2) =>
  count1.W === count2.W &&
  count1.U === count2.U &&
  count1.B === count2.B &&
  count1.R === count2.R &&
  count1.G === count2.G;

// TODO: Consider dual lands?
export const getCombinationForLands = (lands) => {
  const combination = Object.entries(lands)
    .filter(([comb, count]) => comb.length === 1 && count > 0)
    .map(([c]) => c);
  return COLOR_COMBINATIONS.find((comb) => arraysAreEqualSets(combination, comb));
};

const calculateRating = (
  lands,
  combination,
  card,
  ratingScore,
  picked,
  seen,
  synergies,
  packNum,
  pickNum,
  initialState,
) => {
  const pickedInCombination = picked.cards[combination.join('')].filter(
    (c) => getCastingProbability(c, lands) > PROB_TO_INCLUDE,
  );
  if (card) {
    const cardCastingProbability = getCastingProbability(card, lands);
    const pickSynergyScore =
      getPickSynergy(pickedInCombination, card, picked, synergies) * getSynergyWeight(packNum, pickNum, initialState);
    return (
      getInternalSynergy(pickedInCombination, picked, synergies) * getSynergyWeight(packNum, pickNum, initialState) +
      getOpenness(combination, seen) *
        getOpennessWeight(packNum, pickNum, initialState) *
        getColorScaling(combination) +
      getColor(pickedInCombination, picked, lands) * getColorWeight(packNum, pickNum, initialState) +
      getFixing(combination, card) * getFixingWeight(packNum, pickNum, initialState) +
      (ratingScore + pickSynergyScore) * cardCastingProbability
    );
  }
  const count = picked.cards[combination.join('')].filter(
    (c) => !cardType(c).toLowerCase().includes('land') && getCastingProbability(c, lands) >= PROB_TO_INCLUDE,
  ).length;
  if (count >= 23) {
    return (
      (getColor(pickedInCombination, picked, lands) + getInternalSynergy(pickedInCombination, picked, synergies)) *
      count
    );
  }
  return -Infinity;
};

// inPack is the number of cards in this pack
export const botRatingAndCombination = (card, picked, seen, synergies, initialState, inPack = 1, packNum = 1) => {
  // Find the color combination that gives us the highest score1
  // that'll be the color combination we want to play currently.
  const pickNum = initialState?.[0]?.[packNum - 1]?.length - inPack + 1;
  const weightedRatingScore = card ? getRating(card) * getRatingWeight(packNum, pickNum, initialState) : 0;
  let prevLands = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  // TODO: Only count dual lands in the combination we want to play.
  let currentLands = { ...picked.lands };
  if (card) {
    const devotions = getDevotions(card);
    for (const [color, devotion] of Object.entries(devotions)) {
      if (currentLands[color] < devotion) {
        let remaining = devotion - currentLands[color];
        currentLands[color] += remaining;
        while (remaining > 0) {
          for (const color2 of COLORS) {
            if (currentLands[color2] > (devotions[color2] ?? 0)) {
              currentLands[color2] -= 1;
              break;
            }
          }
          remaining -= 1;
        }
      }
    }
  }
  let currentCombination = getCombinationForLands(currentLands);
  let currentRating = calculateRating(
    currentLands,
    currentCombination,
    card,
    weightedRatingScore,
    picked,
    seen,
    synergies,
    packNum,
    pickNum,
    initialState,
  );
  while (!landCountsAreEqual(prevLands, currentLands)) {
    prevLands = currentLands;
    let nextLands = currentLands;
    let nextCombination = currentCombination;
    let nextRating = currentRating;
    for (const increaseColor of COLORS) {
      for (const decreaseColor of COLORS) {
        if (increaseColor !== decreaseColor && currentLands[decreaseColor] > 0) {
          const newLands = { ...prevLands };
          newLands[increaseColor] += 1;
          newLands[decreaseColor] -= 1;
          if (!landCountsAreEqual(newLands, prevLands) && (!card || getCastingProbability(card, newLands) > 0)) {
            const newCombination = getCombinationForLands(newLands);
            const newRating = calculateRating(
              newLands,
              newCombination,
              card,
              weightedRatingScore,
              picked,
              seen,
              synergies,
              packNum,
              pickNum,
              initialState,
            );
            if (newRating > nextRating) {
              nextLands = newLands;
              nextCombination = newCombination;
              nextRating = newRating;
            }
          }
        }
      }
    }
    if (Object.entries(nextLands).reduce((acc, [, a]) => acc + a, 0) !== 17) {
      console.log(card.details.name);
      console.log(currentRating, JSON.stringify(currentLands), '->', nextRating, JSON.stringify(nextLands));
    }
    currentLands = nextLands;
    currentCombination = nextCombination;
    currentRating = nextRating;
  }
  return { rating: currentRating, colors: currentCombination, lands: currentLands };
};

// The cost factor of playing more colors
export const getColorScaling = (combination) => {
  return COLOR_SCALING_FACTOR[combination.length];
};

export const unWeightedRating = (card, picked, seen, synergies) => {
  // Find the color combination that gives us the highest score1
  // that'll be the color combination we want to play currently.
  let bestRating = -Infinity;
  let bestCombination = [];

  for (const combination of COLOR_COMBINATIONS) {
    let rating = -Infinity;
    if (card && (considerInCombination(combination, card) || isPlayableLand(combination, card))) {
      const colorScaling = getColorScaling(combination);
      const synergy = getPickSynergy(combination, card, picked, synergies);
      const internalSynergy = getInternalSynergy(combination, picked);
      const opennes = getOpenness(combination, seen);
      const color = getColor(combination, picked);
      const fixing = getFixing(combination, card);

      rating = colorScaling * (+synergy + internalSynergy + opennes + color) + fixing;
    } else if (!card) {
      const count = picked.cards[combination.join('')].filter((c) => !cardType(c).toLowerCase().includes('land'))
        .length;
      if (count >= 23) {
        rating =
          COLOR_SCALING_FACTOR[combination.length] ** 2 *
          (getColor(combination, picked) + getInternalSynergy(combination, picked)) *
          count;
      }
    }

    if (rating > bestRating) {
      bestRating = rating;
      bestCombination = combination;
    }
  }
  return [bestRating + getRating(card), bestCombination];
};

export default {
  getRating,
  getColor,
  getInternalSynergy,
  getPickSynergy,
  getOpenness,
  getFixing,
  getRatingWeight,
  getSynergyWeight,
  getOpennessWeight,
  getColorWeight,
  getFixingWeight,
  botRatingAndCombination,
  considerInCombination,
};
