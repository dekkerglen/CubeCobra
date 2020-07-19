import similarity from 'compute-cosine-similarity';

import { COLOR_COMBINATIONS, COLOR_INCLUSION_MAP, cardColorIdentity, cardName, cardType } from 'utils/Card';

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

// Ignore synergy below this value.
const SIMILARITY_CLIP = 0.7;
const SIMILARITY_MULTIPLIER = 1 / (1 - SIMILARITY_CLIP);

export const scaleSimilarity = (value) =>
  SIMILARITY_MULTIPLIER * Math.min(Math.max(0, value - SIMILARITY_CLIP), 0.997 - SIMILARITY_CLIP);

// Scale to get similarity range to approximately [0, 10]
export const SYNERGY_SCALE = 0.2;

const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

export const considerInCombination = (combination, card) =>
  card && COLOR_INCLUSION_MAP[combination.join('')][(cardColorIdentity(card) ?? []).join('')];

export const isPlayableLand = (colors, card) =>
  considerInCombination(colors, card) ||
  colors.filter((c) => cardColorIdentity(card).includes(c)).length > 1 ||
  (fetchLands[card.details.name] && fetchLands[card.details.name].some((c) => colors.includes(c)));

// The cost factor of playing more colors
export const getColorScaling = (combination) => {
  return COLOR_SCALING_FACTOR[combination.length];
};

// What is the raw power level of this card? Used to choose a card within a combination.
// Scale is roughly 0-10.
export const getRating = (card) => {
  return 10 ** ((card?.rating ?? 1200) / 400 - 3);
};

// How much does the card we're considering synergize with the cards we've picked?
// Scale is roughly 0-10. Used to select a card within a combination.
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
        // Sum cards have all 0's as their coordinates which gives NaN in similarity.
        if (Number.isFinite(similarityValue)) {
          synergy += -Math.log(1 - scaleSimilarity(similarityValue)) / SYNERGY_SCALE;
        }
      }
    }
  }
  return synergy / picked.cards.WUBRG.length;
};

// Does this help us fix for this combination of colors?
// Scale from 0-10. Perfect is five-color land in 5 color combination.
// Used to select a card within a color combination.
export const getFixing = (combination, card) => {
  const colors = fetchLands[card.details.name] ?? cardColorIdentity(card);
  const typeLine = cardType(card);
  const isLand = typeLine.includes('Land');
  const isFetch = !!fetchLands[cardName(card)];

  if (isLand) {
    const overlap = 4 * colors.filter((c) => combination.includes(c)).length;
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

// How much do the cards we've already picked in this combo synergize with each other?
// Scale is roughly 0-10. Used to select a color combination.
// Tends to recommend what we've already picked before.
export const getInternalSynergy = (combination, picked) => {
  const combStr = combination.join('');
  if (picked.cards.WUBRG.length === 0) {
    return 0;
  }

  const numPairs = (picked.cards.WUBRG.length * (picked.cards.WUBRG.length + 1)) / 2;
  // Need to multiply it here as well since it is quadratic in cards in color
  return (COLOR_SCALING_FACTOR[combination.length] * picked.synergies[combStr]) / numPairs;
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
export const getColor = (combination, picked) => {
  const count = picked.cards.WUBRG.length - picked.cards[''].length;
  if (count === 0) {
    return 0;
  }

  return picked.values[combination.join('')] / count;
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

// inPack is the number of cards in this pack
export const botRatingAndCombination = (card, picked, seen, synergies, initialState, inPack = 1, packNum = 1) => {
  // Find the color combination that gives us the highest score1
  // that'll be the color combination we want to play currently.
  const pickNum = initialState?.[0]?.[packNum - 1]?.length - inPack + 1;
  let bestRating = -Infinity;
  let bestCombination = [];
  const weightedRatingScore = card ? getRating(card) * getRatingWeight(packNum, pickNum, initialState) : 0;
  for (const combination of COLOR_COMBINATIONS) {
    let rating = -Infinity;
    if (card && (considerInCombination(combination, card) || isPlayableLand(combination, card))) {
      rating =
        getColorScaling(combination) *
          (getPickSynergy(combination, card, picked, synergies) * getSynergyWeight(packNum, pickNum, initialState) +
            getInternalSynergy(combination, picked) * getSynergyWeight(packNum, pickNum, initialState) +
            getOpenness(combination, seen) * getOpennessWeight(packNum, pickNum, initialState) +
            getColor(combination, picked) * getColorWeight(packNum, pickNum, initialState)) +
        getFixing(combination, card) * getFixingWeight(packNum, pickNum, initialState);
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
  return [bestRating + weightedRatingScore, bestCombination];
};

// inPack is the number of cards in this pack
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
