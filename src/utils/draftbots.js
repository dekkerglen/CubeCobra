import similarity from 'compute-cosine-similarity';

import { COLOR_COMBINATIONS, COLOR_INCLUSION_MAP, cardColorIdentity, cardName, cardType } from 'utils/Card';

// We want to discourage playing more colors so they get less
// value the more colors, this gets offset by having more cards.
const COLOR_SCALING_FACTOR = [1, 1, 0.67, 0.48, 0.24, 0.15];
const COLORS_WEIGHTS = [
  [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
  [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
  [25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25],
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
  [4, 8, 8.2, 8.4, 8.6, 8.8, 9, 9.2, 9.5, 9.1, 8.7, 8.3, 7.9, 7.5, 7.1],
  [9, 8.6, 8.2, 7.8, 7.4, 7, 6.6, 6.2, 5.8, 5.4, 5, 4.6, 4.2, 3.8, 3.4],
  [4, 3.6, 3.2, 2.8, 2.4, 2, 1.6, 1.4, 1.2, 1, 0.8, 0.6, 0.4, 0.2, 0],
];

// These functions get approximate weight values when there are not 15 cards in the pack.
// They treat pack/pick number out of 3/15 as a lattice and just average the surrounding points if the desired weight is off the lattice.
const interpolateWeight1d = (weights, pickNumPercent) => {
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

const interpolateWeight2d = (weights, packNum, pickNum, initialState) => {
  const packNumPercent = (packNum - 1) / initialState[0].length;
  const pickNumPercent = (pickNum - 1) / initialState[0][packNum - 1].length;
  const index = weights.length * packNumPercent;
  const ceilIndex = Math.ceil(index);
  const floorIndex = Math.floor(index);
  // Is either an integer or is past the end by less than 1 so we can use floor as our index
  if (index === floorIndex || ceilIndex === weights.length) {
    return interpolateWeight1d(weights[floorIndex], pickNumPercent);
  }
  // The fractional part of index.
  const indexModOne = index - floorIndex;
  // If is fractional and not past the end we weight it by the two
  // closest points by how close it is to that point.
  return (
    indexModOne * interpolateWeight1d(weights[ceilIndex], pickNumPercent) +
    (1 - indexModOne) * interpolateWeight1d(weights[floorIndex], pickNumPercent)
  );
};

export const fetchLands = {
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

export const considerInCombination = (combination, card) =>
  card && COLOR_INCLUSION_MAP[combination.join('')][(cardColorIdentity(card) ?? []).join('')];

export const isPlayableLand = (colors, card) =>
  considerInCombination(colors, card) ||
  colors.filter((c) => cardColorIdentity(card).includes(c)).length > 0 ||
  (fetchLands[card.details.name] && fetchLands[card.details.name].some((c) => colors.includes(c)));

export const getColorScaling = (combination) => {
  return COLOR_SCALING_FACTOR[combination.length];
};

// What is the raw power level of this card?
// Scale is roughly 0-100, linear. Black Lotus should be ~100.
export const getRating = (card) => {
  return 10 ** ((card?.rating ?? 1200) / 400 - 3);
};

// Ignore synergy below this value.
const SIMILARITY_CLIP = 0.7;
const SIMILARITY_MULTIPLIER = 1 / (1 - SIMILARITY_CLIP);

export const scaleSimilarity = (value) => SIMILARITY_MULTIPLIER * Math.max(0, value - SIMILARITY_CLIP);

// Scale to get similarity range to approximately [0, 10]
export const SYNERGY_SCALE = 0.2;

// How much do the cards we've already picked in this combo synergize with each other?
// Scale is roughly 0-1.
export const getInternalSynergy = (combination, picked) => {
  const combStr = combination.join('');
  if (picked.cards.WUBRG.length === 0) {
    return 0;
  }

  const numPairs = (picked.cards.WUBRG.length * (picked.cards.WUBRG.length + 1)) / 2;
  return picked.synergies[combStr] / numPairs;
};

// How much does the card we're considering synergize with the cards we've picked?
// Scale is roughly 0-1.
export const getPickSynergy = (combination, card, picked, synergies) => {
  if (picked.cards.WUBRG.length === 0 || !synergies) {
    return 0;
  }

  let synergy = 0;
  if (synergies && card) {
    for (const { index } of picked.cards[combination.join('')]) {
      // Don't count synergy for duplicate cards.
      // Maximum synergy is generally around .997 which corresponds to ~1.
      if (index !== card.index) {
        const similarityValue = similarity(synergies[index], synergies[card.index]);
        synergy += -Math.log(1 - scaleSimilarity(similarityValue)) / SYNERGY_SCALE;
      }
    }
  }
  return synergy / picked.cards.WUBRG.length;
};

// Has this color combination been flowing openly?
// Scale from 0-1.
export const getOpenness = (combination, seen) => {
  if (seen.cards.length === 0) {
    return 0;
  }

  return seen.values[combination.join('')] / seen.cards.WUBRG.length;
};

// How good are the cards we've already picked in this color combo?
// Scale from 0-1.
export const getColor = (combination, picked) => {
  if (picked.cards.WUBRG.length === 0) {
    return 0;
  }

  return picked.values[combination.join('')] / picked.cards.WUBRG.length;
};

const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

// Does this help us fix for this combination of colors?
// Scale from 0-1. Perfect is double-on-color fetch.
export const getFixing = (combination, card) => {
  const colors = fetchLands[card.details.name] ?? cardColorIdentity(card);
  const typeLine = cardType(card);
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[cardName(card)];

  if (isLand) {
    const overlap = colors.filter((c) => combination.includes(c)).length;
    const hasBasicTypes = basics.filter((basic) => typeLine.toLowerCase().includes(basic.toLowerCase())).length > 1;
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

export const getRatingWeight = (pack, pick, initialState) => {
  return interpolateWeight2d(RATING_WEIGHTS, pack, pick, initialState);
};

export const getSynergyWeight = (pack, pick, initialState) => {
  return interpolateWeight2d(SYNERGY_WEIGHTS, pack, pick, initialState);
};

export const getOpennessWeight = (pack, pick, initialState) => {
  return interpolateWeight2d(OPENNESS_WEIGHTS, pack, pick, initialState);
};

export const getColorWeight = (pack, pick, initialState) => {
  return interpolateWeight2d(COLORS_WEIGHTS, pack, pick, initialState);
};

export const getFixingWeight = (pack, pick, initialState) => {
  return interpolateWeight2d(FIXING_WEIGHTS, pack, pick, initialState);
};

// inPack is the number of cards in this pack
export const botRatingAndCombination = (card, picked, seen, synergies, initialState, inPack = 1, packNum = 1) => {
  // Find the color combination that gives us the highest score1
  // that'll be the color combination we want to play currently.
  const pickNum = initialState?.[0]?.[packNum - 1]?.length - inPack + 1;
  let bestRating = -Infinity;
  let bestCombination = [];
  const weightedRatingScore = card ? getRating(card) * getRatingWeight(packNum, pickNum, initialState) : 0;
  for (const combination of COLOR_COMBINATIONS.filter((comb) => comb.length > 0 && comb.length < 4)) {
    let rating = -Infinity;
    if (card && (considerInCombination(combination, card) || isPlayableLand(combination, card))) {
      rating =
        (getPickSynergy(combination, card, picked, synergies) * getSynergyWeight(packNum, pickNum, initialState) +
          getInternalSynergy(combination, picked) * getSynergyWeight(packNum, pickNum, initialState) +
          getOpenness(combination, seen) * getOpennessWeight(packNum, pickNum, initialState) +
          getColor(combination, picked) * getColorWeight(packNum, pickNum, initialState) +
          getFixing(combination, card) * getFixingWeight(packNum, pickNum, initialState)) *
        getColorScaling(combination);
    } else if (!card) {
      const count = picked.cards[combination.join('')].filter((c) => !cardType(c).toLowerCase().includes('land'))
        .length;
      if (count >= 23) {
        rating = Math.log(
          COLOR_SCALING_FACTOR[combination.length] ** 2 *
            (getColor(combination, picked) + getInternalSynergy(combination, picked)) *
            count,
        );
      }
    }
    if (rating > bestRating) {
      bestRating = rating;
      bestCombination = combination;
    }
  }
  return [bestRating + weightedRatingScore, bestCombination];
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
